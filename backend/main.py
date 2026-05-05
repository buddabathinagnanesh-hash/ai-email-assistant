import os
import datetime
import base64
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from apscheduler.schedulers.blocking import BlockingScheduler
from dotenv import load_dotenv

load_dotenv()

import db
import ai
import auth

# ==============================
# VALIDATION
# ==============================
def validate_date(date_str):
    """Ensure date is valid, not in the past, and not a vague string."""
    if not isinstance(date_str, str): return None
    
    try:
        dt = None
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
            try:
                dt = datetime.datetime.strptime(date_str, fmt)
                dt = dt.replace(hour=10, minute=0, second=0, microsecond=0)
                break
            except ValueError:
                pass
        
        if not dt:
            dt = datetime.datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            
        now = datetime.datetime.now(dt.tzinfo)
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        dt_day = dt.replace(hour=0, minute=0, second=0, microsecond=0)
        
        if dt.year < now.year:
            return None
        if dt_day < today:
            return None
            
        return dt.isoformat()
    except Exception:
        return None

# ==============================
# CONFIG
# ==============================
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

# ==============================
# AUTH
# ==============================
def authenticate():
    creds = None
    if os.path.exists("token.json"):
        creds = Credentials.from_authorized_user_file("token.json", SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_config(
                {
                    "installed": {
                        "client_id": os.environ.get("CLIENT_ID"),
                        "client_secret": os.environ.get("CLIENT_SECRET"),
                        "redirect_uris": ["http://localhost"],
                        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                        "token_uri": "https://oauth2.googleapis.com/token",
                    }
                },
                SCOPES
            )
            creds = flow.run_local_server(port=0)

        with open("token.json", "w") as f:
            f.write(creds.to_json())

    return build("gmail", "v1", credentials=creds)

# ==============================
# FETCH EMAILS
# ==============================
def fetch_emails(service):
    # Compute last 24 hours timestamp to avoid timezone issues
    last_24_hours = int(datetime.datetime.now().timestamp()) - 86400
    query = f"after:{last_24_hours}"
    
    print(f"\nFetching emails with query: {query}")

    try:
        # Fetch last 20 emails
        result = service.users().messages().list(userId="me", q=query, maxResults=20).execute()
        messages = result.get("messages", [])
    except Exception as e:
        print(f"Failed to list messages: {e}")
        return []

    print(f"Found {len(messages)} new messages in the last 24 hours.")

    emails = []

    for msg in messages:
        try:
            data = service.users().messages().get(
                userId="me", id=msg["id"], format="full"
            ).execute()

            headers = data["payload"]["headers"]

            subject = next((h["value"] for h in headers if h["name"] == "Subject"), "No Subject")
            sender = next((h["value"] for h in headers if h["name"] == "From"), "Unknown Sender")

            print(f"FETCHED: {subject}")
            print(f"  -> Fetched: {subject[:50]}")

            body = ""
            if "parts" in data["payload"]:
                for part in data["payload"]["parts"]:
                    if part["mimeType"] == "text/plain" and "data" in part["body"]:
                        body = base64.urlsafe_b64decode(part["body"]["data"]).decode()
                        break
            elif "body" in data["payload"] and "data" in data["payload"]["body"]:
                 body = base64.urlsafe_b64decode(data["payload"]["body"]["data"]).decode()

            internal_date = int(data.get("internalDate", 0))
            created_at = datetime.datetime.fromtimestamp(internal_date / 1000.0).isoformat() if internal_date else datetime.datetime.now().isoformat()

            emails.append({
                "id": msg["id"],
                "subject": subject,
                "sender": sender,
                "body": body,
                "created_at": created_at,
                "link": f"https://mail.google.com/mail/u/0/#inbox/{msg['id']}"
            })
        except Exception as e:
            print(f"  -> Error parsing message {msg.get('id')}: {e}")

    return emails

# ==============================
# CALENDAR
# ==============================
def create_calendar_event(email):
    """Automatically create a Google Calendar event from the email."""
    if not os.path.exists("token.json"):
        print("  -> Skipping calendar: No OAuth token. Connect via frontend first.")
        return "Please login"

    creds = Credentials.from_authorized_user_file("token.json", ["https://www.googleapis.com/auth/calendar"])
    
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
        with open("token.json", "w") as f:
            f.write(creds.to_json())

    try:
        service = build("calendar", "v3", credentials=creds)
        date_str = email["dates"][0]
        
        try:
            # Try YYYY-MM-DD format, default to 9 AM
            start_dt = datetime.datetime.strptime(date_str, "%Y-%m-%d").replace(hour=9, minute=0)
        except ValueError:
            try:
                # Try full ISO format
                start_dt = datetime.datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            except ValueError:
                print(f"  -> Could not parse date for calendar: {date_str}")
                return False

        end_dt = start_dt + datetime.timedelta(hours=1)

        event = {
            'summary': email['subject'],
            'description': email['summary'],
            'start': {
                'dateTime': start_dt.isoformat(),
                'timeZone': 'Asia/Kolkata',
            },
            'end': {
                'dateTime': end_dt.isoformat(),
                'timeZone': 'Asia/Kolkata',
            },
        }

        service.events().insert(calendarId='primary', body=event).execute()
        print("  -> 📅 Google Calendar event created successfully!")
        return True
    except Exception as e:
        print(f"  -> ⚠️ Failed to create calendar event: {e}")
        return False

# ==============================
# PIPELINE
# ==============================
def run_pipeline():
    print("\nRunning pipeline...")

    service = authenticate()
    emails = fetch_emails(service)

    for e in emails:
        if db.exists(e["id"]):
            print(f"Skipping duplicate (already in DB): {e['subject'][:40]}")
            continue

        print(f"Processing new email: {e['subject'][:40]}")
        raw = ai.call_ai(e)
        cat, pri, summ, dates = ai.clean(raw)

        cat, pri = ai.apply_rules(e["subject"], e["body"], cat, pri)
        cat, pri = ai.apply_safety(cat, pri, e["subject"], e["body"])

        print("RAW AI DATES:", dates)
        
        valid_dates = []
        for d in dates:
            valid_d = validate_date(d)
            if valid_d:
                valid_dates.append(valid_d)
                
        dates = valid_dates
        print("FINAL DATE USED:", dates)

        e["category"] = cat
        e["priority"] = pri
        e["summary"] = summ
        e["dates"] = dates
        e["date"] = dates[0] if dates else None

        e["calendar_added"] = 0
        if dates and len(dates) > 0:
            success = create_calendar_event(e)
            if success:
                e["calendar_added"] = 1

        db.save(e)
        print(f"SAVED: {e['subject']}")

        print(f"{cat} | {pri} | {e['subject'][:60]}")

# ==============================
# SCHEDULER
# ==============================
def start():
    run_pipeline()
    scheduler = BlockingScheduler()
    scheduler.add_job(run_pipeline, "interval", minutes=10)
    scheduler.start()

# ==============================
# MAIN
# ==============================
if __name__ == "__main__":
    db.setup_db()
    start()