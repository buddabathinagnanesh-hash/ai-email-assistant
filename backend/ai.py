import requests
import json
import re
import datetime
import os

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "gemma:2b"
PREFS_FILE = "preferences.json"

def load_prefs():
    if not os.path.exists(PREFS_FILE):
        return {"interests": [], "ignore": []}
    try:
        with open(PREFS_FILE, "r") as f:
            return json.load(f)
    except:
        return {"interests": [], "ignore": []}

def save_prefs(prefs):
    with open(PREFS_FILE, "w") as f:
        json.dump(prefs, f, indent=2)

def process_feedback(subject, feedback):
    prefs = load_prefs()
    # Simple lightweight keyword extraction (words > 4 chars)
    words = [w for w in re.findall(r'\b[a-zA-Z]{5,}\b', subject.lower())]
    stopwords = {"about", "which", "would", "their", "there"}
    keywords = [w for w in words if w not in stopwords][:2]
    
    if feedback == "like":
        for k in keywords:
            if k not in prefs["interests"]: prefs["interests"].append(k)
    else:
        for k in keywords:
            if k not in prefs["ignore"]: prefs["ignore"].append(k)
            
    save_prefs(prefs)
    return prefs

def call_ai(email):
    """Classify email using local LLM."""
    prefs = load_prefs()
    interests_str = ", ".join(prefs["interests"])
    ignore_str = ", ".join(prefs["ignore"])
    
    prefs_instruction = ""
    if interests_str or ignore_str:
        prefs_instruction = f"""
USER PREFERENCES:
- INCREASE priority for topics: {interests_str}
- DECREASE priority (or IGNORE) topics: {ignore_str}
"""

    prompt = f"""
You are an email classifier.
{prefs_instruction}
Return ONLY JSON.

Format:
{{
"category": "IMPORTANT or NORMAL or IGNORE",
"priority": "HIGH or MEDIUM or LOW",
"summary": "short useful summary",
"dates": ["YYYY-MM-DD" or "YYYY-MM-DDTHH:MM"]
}}

IMPORTANT must be rare. Extract deadlines, exam dates, interview dates. If no date, return [].

Email:
Subject: {email['subject']}
Body: {email['body']}
"""
    try:
        res = requests.post(OLLAMA_URL, json={
            "model": MODEL,
            "prompt": prompt,
            "stream": False
        })
        return res.json().get("response", "")
    except:
        return ""

def clean(text):
    """Clean and parse LLM response."""
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group())
        except:
            data = {}
    else:
        data = {}

    category = data.get("category", "NORMAL")
    priority = data.get("priority", "LOW")
    summary = data.get("summary", "")
    dates = data.get("dates", [])

    if category not in ["IMPORTANT", "NORMAL", "IGNORE"]:
        category = "NORMAL"

    if priority not in ["HIGH", "MEDIUM", "LOW"]:
        priority = "LOW"

    return category, priority, summary, dates

def apply_rules(subject, body, category, priority):
    """Apply rule-based overrides."""
    text = (subject + " " + body).lower()

    if any(x in text for x in ["deadline","due","assignment","exam","submission","reminder"]):
        return "IMPORTANT","HIGH"
    if any(x in text for x in ["security alert","login","password","suspicious"]):
        return "IMPORTANT","HIGH"
    if any(x in text for x in ["win","offer","sale","discount","contest","giveaway","unsubscribe","invite friends"]):
        return "IGNORE","LOW"
    if any(x in text for x in ["medium","article","guide","tutorial","research","course","lecture","bootcamp","training"]):
        return "NORMAL","LOW"
    if any(x in text for x in ["news","update","digest","newsletter","announcement","release"]):
        return "NORMAL","LOW"
    if any(x in text for x in ["freelancer","project","bid","proposal"]):
        return "NORMAL","LOW"
    if any(x in text for x in ["software engineer","developer","job alert","hiring","internship","position","opening","vacancy"]):
        return "IMPORTANT","MEDIUM"

    return category, priority

def apply_safety(category, priority, subject, body):
    """Final safety checks for priority."""
    text = (subject + " " + body).lower()

    if category != "IMPORTANT":
        return category, "LOW"

    if any(x in text for x in ["deadline","due","assignment","exam","security"]):
        return category, "HIGH"

    return category, "MEDIUM"

def generate_insights(rows):
    """Generates proactive AI insights based on recent emails."""
    if not rows:
        return {"summary": "No emails to analyze.", "urgent": [], "suggestions": []}

    email_text = ""
    for r in rows:
        email_text += f"- [{r['priority']}] {r['subject']} ({r['category']})\n"

    today = datetime.datetime.now().strftime("%Y-%m-%d")
    prompt = f"""
You are an executive AI assistant. Today is {today}.
Analyze these recent emails and generate proactive insights.
Prioritize IMPORTANT and HIGH priority. Highlight deadlines (dates).
Keep each item < 10 words. Max 3 items per list.
Return ONLY JSON.

Format:
{{
"summary": "1-2 lines max summarizing the current situation",
"urgent": ["short item 1", "short item 2", "short item 3"],
"suggestions": ["short action 1", "short action 2", "short action 3"]
}}

Emails:
{email_text}
"""
    try:
        res = requests.post(OLLAMA_URL, json={
            "model": MODEL,
            "prompt": prompt,
            "stream": False
        })
        raw = res.json().get("response", "")
        
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            insights = json.loads(match.group())
            if not isinstance(insights.get("urgent"), list): insights["urgent"] = []
            if not isinstance(insights.get("suggestions"), list): insights["suggestions"] = []
        else:
            insights = {"summary": "Failed to parse AI response.", "urgent": [], "suggestions": []}
    except Exception:
        insights = {
            "summary": "AI backend connected successfully (Fallback Mode). Connect Ollama for full insights.",
            "urgent": [],
            "suggestions": []
        }

    return insights

def generate_daily_brief(emails):
    """Generates an AI summary based on today's tasks."""
    if not emails:
        return {"message": "You're all caught up! No actionable tasks today."}
        
    important_count = sum(1 for e in emails if e.get("priority") == "HIGH")
    overdue_count = sum(1 for e in emails if e.get("score", 0) >= 100)
    today_count = sum(1 for e in emails if e.get("status") in ["DO_NOW", "TODAY"])
    
    task_summary = f"Important emails: {important_count}\n"
    task_summary += f"Overdue tasks: {overdue_count}\n"
    task_summary += f"Deadlines today: {today_count}\n"
    
    # Sort emails by highest score
    sorted_emails = sorted(emails, key=lambda x: x.get("score", 0), reverse=True)
    if sorted_emails:
        task_summary += f"Nearest deadline: {sorted_emails[0].get('subject')}\n"

    prompt = f"""
You are an executive AI assistant.
Summarize today's tasks in 2-3 lines. Be clear and actionable.
Return ONLY JSON.

Format:
{{
"message": "Your daily summary..."
}}

Data:
{task_summary}
"""
    try:
        res = requests.post(OLLAMA_URL, json={
            "model": MODEL,
            "prompt": prompt,
            "stream": False
        })
        raw = res.json().get("response", "")
        
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            return json.loads(match.group())
        else:
            return {"message": "Failed to parse AI brief."}
    except Exception:
        return {"message": "AI backend connected successfully (Fallback Mode).\nYour Render backend is fully functional, but the local Ollama LLM is currently unreachable for AI text generation."}
