from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from pydantic import BaseModel
import time
import threading
import datetime
from zoneinfo import ZoneInfo
from dotenv import load_dotenv

load_dotenv()

import main
import db
import ai
import auth

INSIGHTS_CACHE = {"data": None, "timestamp": 0}
BRIEFING_CACHE = {"data": None, "timestamp": 0}
pipeline_lock = threading.Lock()
PENDING_REMINDERS = []

app = FastAPI(title="AI Email Processing API")
app.include_router(auth.router)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def start_scheduler():
    db.setup_db()
    scheduler = BackgroundScheduler()
    scheduler.add_job(main.run_pipeline, "interval", minutes=10)
    scheduler.add_job(check_reminders, "interval", seconds=60)
    scheduler.start()

@app.get("/emails")
def get_all_emails():
    """Fetch all processed emails from the database."""
    return db.get_all_emails()

@app.get("/emails/{category}")
def filter_emails_by_category(category: str):
    """Filter processed emails by a specific category."""
    return db.filter_emails_by_category(category)

@app.post("/run")
def trigger_pipeline():
    """
    Manually triggers the existing email processing pipeline synchronously.
    """
    main.run_pipeline()
    return {"message": "Pipeline triggered successfully"}

def parse_date(date_str):
    tz = ZoneInfo("Asia/Kolkata")
    try:
        dt = datetime.datetime.strptime(date_str, "%Y-%m-%d").replace(hour=9, minute=0)
        return dt.replace(tzinfo=tz)
    except ValueError:
        try:
            dt = datetime.datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=tz)
            return dt
        except ValueError:
            return None

def check_reminders():
    """Checks upcoming dates and generates reminders."""
    emails = db.get_pending_reminders()
    now = datetime.datetime.now(ZoneInfo("Asia/Kolkata"))
    
    for e in emails:
        if not e["dates"]: continue
        
        dt = parse_date(e["dates"][0])
        if not dt: continue
            
        diff = dt - now
        total_seconds = diff.total_seconds()
        
        if total_seconds < 0:
            continue # already passed
            
        hours_left = total_seconds / 3600
        mins_left = total_seconds / 60
        
        # 10 mins check
        if mins_left <= 10 and e["reminded_10m"] == 0:
            PENDING_REMINDERS.append({
                "message": f"Deadline in 10 mins: {e['subject']}",
                "type": "urgent"
            })
            db.update_reminder_flag(e["id"], "reminded_10m")
            
        # 1 hour check
        elif hours_left <= 1 and e["reminded_1h"] == 0:
            PENDING_REMINDERS.append({
                "message": f"Deadline in 1 hour: {e['subject']}",
                "type": "warning"
            })
            db.update_reminder_flag(e["id"], "reminded_1h")
            
        # 24 hours check
        elif hours_left <= 24 and e["reminded_24h"] == 0:
            PENDING_REMINDERS.append({
                "message": f"Deadline tomorrow: {e['subject']}",
                "type": "upcoming"
            })
            db.update_reminder_flag(e["id"], "reminded_24h")

@app.get("/reminders")
def get_reminders():
    """Returns triggered reminders and clears the queue."""
    global PENDING_REMINDERS
    res = list(PENDING_REMINDERS)
    PENDING_REMINDERS.clear()
    return res

def urgency_score(email, now):
    score = 0
    if not email.get("date"):
        return -1, "LATER"

    try:
        dt = datetime.datetime.fromisoformat(email["date"].replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=now.tzinfo)
    except Exception:
        return -1, "LATER"
        
    delta = (dt - now).total_seconds()
    
    if delta < 0:          score += 100
    elif delta < 3600:     score += 80
    elif delta < 86400:    score += 60
    elif delta < 3*86400:  score += 40
    else:                  score += 10

    if email.get("priority") == "HIGH":   score += 30
    elif email.get("priority") == "MEDIUM": score += 15
    
    if email.get("done") == 1:
        score -= 100
        
    status = "LATER"
    if delta < 86400:
        status = "DO_NOW"
    elif delta < 3 * 86400:
        status = "TODAY"
    else:
        status = "LATER"

    return score, status

@app.get("/today")
def get_today():
    emails = db.get_actionable_tasks()
    now = datetime.datetime.now(ZoneInfo("Asia/Kolkata"))
    
    tasks = []
    for e in emails:
        score, status = urgency_score(e, now)
        if score >= -50:
            e["score"] = score
            e["status"] = status
            tasks.append(e)
            
    tasks.sort(key=lambda x: x["score"], reverse=True)
    
    do_now = [t for t in tasks if t["status"] == "DO_NOW"]
    today = [t for t in tasks if t["status"] == "TODAY"]
    later = [t for t in tasks if t["status"] == "LATER"]
    
    return {"do_now": do_now, "today": today, "later": later}

@app.post("/test-calendar")
def test_calendar():
    """Manually test the calendar creation logic using stored credentials."""
    email = {
        "subject": "Test Meeting",
        "summary": "Testing event",
        "dates": ["2026-05-05T10:00:00"]
    }
    success = main.create_calendar_event(email)
    return {"success": success, "message": "Check your console logs and Google Calendar!"}

@app.get("/stats")
def get_stats():
    """Returns the total count of emails for each category."""
    return db.get_stats()

@app.post("/mark-done/{email_id}")
def mark_done(email_id: str):
    """Toggle the done status of an email."""
    db.toggle_done(email_id)
    return {"message": "Success"}

@app.post("/pin/{email_id}")
def toggle_pin(email_id: str):
    """Toggle the pinned status of an email."""
    db.toggle_pin(email_id)
    return {"message": "Success"}

@app.get("/upcoming")
def get_upcoming():
    """Fetch all emails that have parsed dates."""
    return db.get_upcoming()

class QueryRequest(BaseModel):
    query: str

class FeedbackRequest(BaseModel):
    subject: str
    feedback: str

class UpdatePrefsRequest(BaseModel):
    interests: list
    ignore: list

@app.post("/feedback")
def submit_feedback(req: FeedbackRequest):
    """Saves user feedback to adjust AI prompt priorities."""
    prefs = ai.process_feedback(req.subject, req.feedback)
    return {"message": "Feedback saved", "prefs": prefs}

@app.get("/preferences")
def get_prefs():
    """Gets current user preferences."""
    return ai.load_prefs()

@app.post("/preferences")
def update_prefs(req: UpdatePrefsRequest):
    """Updates user preferences manually."""
    prefs = {"interests": req.interests, "ignore": req.ignore}
    ai.save_prefs(prefs)
    return {"message": "Preferences saved"}

@app.post("/query")
def ai_query(req: QueryRequest):
    """Returns matching emails using keyword filtering."""
    try:
        return db.search_emails(req.query.strip())
    except Exception as e:
        print(f"Query error: {e}")
        return []

@app.get("/insights")
def get_insights():
    """Generates proactive AI insights based on recent emails, cached for 10 minutes."""
    current_time = time.time()
    
    if INSIGHTS_CACHE["data"] and (current_time - INSIGHTS_CACHE["timestamp"]) < 600:
        return INSIGHTS_CACHE["data"]
        
    recent_emails = db.get_todays_emails_for_insights()
    insights = ai.generate_insights(recent_emails)
    
    INSIGHTS_CACHE["data"] = insights
    INSIGHTS_CACHE["timestamp"] = current_time
    
    return insights

@app.get("/daily-brief")
def get_daily_brief():
    """Generates a daily AI brief, cached for 5 minutes."""
    current_time = time.time()
    
    if BRIEFING_CACHE["data"] and (current_time - BRIEFING_CACHE["timestamp"]) < 300:
        return BRIEFING_CACHE["data"]
        
    tasks_dict = get_today()
    all_tasks = tasks_dict.get("do_now", []) + tasks_dict.get("today", []) + tasks_dict.get("later", [])
    
    briefing = ai.generate_daily_brief(all_tasks)
    
    BRIEFING_CACHE["data"] = briefing
    BRIEFING_CACHE["timestamp"] = current_time
    
    return briefing
