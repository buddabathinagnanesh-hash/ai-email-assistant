import sqlite3
import datetime
import json

DB_NAME = "emails.db"

def get_db_connection():
    """Helper to get a database connection that returns dict-like rows."""
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def setup_db():
    conn = sqlite3.connect(DB_NAME)
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS emails(
        id TEXT PRIMARY KEY,
        subject TEXT,
        sender TEXT,
        category TEXT,
        priority TEXT,
        summary TEXT,
        link TEXT
    )
    """)

    # Safe schema upgrades
    try: cur.execute("ALTER TABLE emails ADD COLUMN done INTEGER DEFAULT 0")
    except sqlite3.OperationalError: pass
        
    try: cur.execute("ALTER TABLE emails ADD COLUMN pinned INTEGER DEFAULT 0")
    except sqlite3.OperationalError: pass
        
    try: cur.execute("ALTER TABLE emails ADD COLUMN created_at TEXT")
    except sqlite3.OperationalError: pass

    try: cur.execute("ALTER TABLE emails ADD COLUMN dates TEXT")
    except sqlite3.OperationalError: pass

    try: cur.execute("ALTER TABLE emails ADD COLUMN date TEXT")
    except sqlite3.OperationalError: pass

    try: cur.execute("ALTER TABLE emails ADD COLUMN calendar_added INTEGER DEFAULT 0")
    except sqlite3.OperationalError: pass

    try: cur.execute("ALTER TABLE emails ADD COLUMN reminded_24h INTEGER DEFAULT 0")
    except sqlite3.OperationalError: pass
    try: cur.execute("ALTER TABLE emails ADD COLUMN reminded_1h INTEGER DEFAULT 0")
    except sqlite3.OperationalError: pass
    try: cur.execute("ALTER TABLE emails ADD COLUMN reminded_10m INTEGER DEFAULT 0")
    except sqlite3.OperationalError: pass

    cur.execute("CREATE INDEX IF NOT EXISTS idx_subject ON emails(subject)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_category ON emails(category)")

    conn.commit()
    conn.close()

def exists(eid):
    conn = sqlite3.connect(DB_NAME)
    cur = conn.cursor()
    cur.execute("SELECT id FROM emails WHERE id=?", (eid,))
    r = cur.fetchone()
    conn.close()
    return r is not None

def save(e):
    conn = sqlite3.connect(DB_NAME)
    cur = conn.cursor()

    created_at = e.get("created_at", datetime.datetime.now().isoformat())
    dates_json = json.dumps(e.get("dates", []))
    calendar_added = e.get("calendar_added", 0)
    reminded_24h = e.get("reminded_24h", 0)
    reminded_1h = e.get("reminded_1h", 0)
    reminded_10m = e.get("reminded_10m", 0)
    date = e.get("date")
    cur.execute("""
    INSERT INTO emails (id, subject, sender, category, priority, summary, link, done, pinned, created_at, dates, calendar_added, reminded_24h, reminded_1h, reminded_10m, date)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, (
        e["id"], e["subject"], e["sender"],
        e["category"], e["priority"], e["summary"], e["link"],
        0, 0, created_at, dates_json, calendar_added, reminded_24h, reminded_1h, reminded_10m, date
    ))

    conn.commit()
    conn.close()

def get_all_emails():
    """Fetch all processed emails from the database."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, subject, sender, category, priority, summary, link, done, pinned, created_at, dates, calendar_added, date FROM emails ORDER BY id DESC LIMIT 20")
    
    emails = []
    for row in cur.fetchall():
        r = dict(row)
        try:
            r["dates"] = json.loads(r["dates"]) if r.get("dates") else []
        except:
            r["dates"] = []
        emails.append(r)
        
    conn.close()
    return emails

def filter_emails_by_category(category: str):
    """Filter processed emails by a specific category."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, subject, sender, category, priority, summary, link, done, pinned, created_at, dates, calendar_added, date FROM emails WHERE category = ? ORDER BY id DESC LIMIT 20", 
        (category.upper(),)
    )
    
    emails = []
    for row in cur.fetchall():
        r = dict(row)
        try:
            r["dates"] = json.loads(r["dates"]) if r.get("dates") else []
        except:
            r["dates"] = []
        emails.append(r)
        
    conn.close()
    return emails

def get_stats():
    """Returns the total count of emails for each category."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT category, COUNT(*) as count FROM emails GROUP BY category")
    rows = cur.fetchall()
    conn.close()
    
    stats = {
        "important": 0,
        "normal": 0,
        "ignore": 0
    }
    
    for row in rows:
        cat = row["category"].lower()
        if cat in stats:
            stats[cat] = row["count"]
            
    return stats

def toggle_done(email_id: str):
    """Toggle the done status of an email."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("UPDATE emails SET done = NOT done WHERE id = ?", (email_id,))
    conn.commit()
    conn.close()

def toggle_pin(email_id: str):
    """Toggle the pinned status of an email."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("UPDATE emails SET pinned = NOT pinned WHERE id = ?", (email_id,))
    conn.commit()
    conn.close()

def update_reminder_flag(email_id: str, flag: str):
    """Sets a specific reminder flag to 1 for an email."""
    allowed_flags = ["reminded_24h", "reminded_1h", "reminded_10m"]
    if flag not in allowed_flags: return
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(f"UPDATE emails SET {flag} = 1 WHERE id = ?", (email_id,))
    conn.commit()
    conn.close()

def get_pending_reminders():
    """Fetch all upcoming emails that haven't had all reminders sent."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT id, subject, dates, reminded_24h, reminded_1h, reminded_10m 
            FROM emails 
            WHERE dates IS NOT NULL AND dates != '[]'
            AND (reminded_24h = 0 OR reminded_1h = 0 OR reminded_10m = 0)
        """)
        rows = cur.fetchall()
    except sqlite3.OperationalError:
        rows = []
    conn.close()
    
    reminders = []
    for row in rows:
        r = dict(row)
        try: r["dates"] = json.loads(r["dates"]) if r["dates"] else []
        except: r["dates"] = []
        reminders.append(r)
    return reminders

def get_upcoming():
    """Fetch all emails that have parsed dates."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT subject, dates FROM emails WHERE dates IS NOT NULL AND dates != '[]'")
        rows = cur.fetchall()
    except sqlite3.OperationalError:
        rows = []
    conn.close()
    
    upcoming = []
    for row in rows:
        try:
            dates_list = json.loads(row["dates"])
            if isinstance(dates_list, list):
                for d in dates_list:
                    upcoming.append({"subject": row["subject"], "date": d})
        except:
            pass
            
    upcoming.sort(key=lambda x: x["date"])
    return upcoming

def get_actionable_tasks():
    """Fetch emails with valid dates for the daily assistant."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT id, subject, category, priority, summary, link, done, date 
            FROM emails 
            WHERE date IS NOT NULL AND done = 0
            ORDER BY date DESC
        """)
        rows = cur.fetchall()
    except sqlite3.OperationalError:
        rows = []
    conn.close()
    return [dict(row) for row in rows]

def search_emails(q: str):
    """Returns matching emails using keyword filtering."""
    conn = get_db_connection()
    cur = conn.cursor()
    
    if not q:
        cur.execute("SELECT id, subject, sender, category, priority, summary, link, done, pinned, created_at, dates, calendar_added, date FROM emails ORDER BY id DESC LIMIT 20")
        emails = []
        for row in cur.fetchall():
            r = dict(row)
            try: r["dates"] = json.loads(r["dates"]) if r.get("dates") else []
            except: r["dates"] = []
            emails.append(r)
        conn.close()
        return emails

    query_str = f"%{q.lower()}%"
    
    cur.execute("""
        SELECT id, subject, sender, category, priority, summary, link, done, pinned, created_at, dates, calendar_added, date 
        FROM emails 
        WHERE LOWER(subject) LIKE ? OR LOWER(summary) LIKE ? OR LOWER(sender) LIKE ? 
        ORDER BY id DESC LIMIT 20
    """, (query_str, query_str, query_str))
    
    emails = []
    for row in cur.fetchall():
        r = dict(row)
        try: r["dates"] = json.loads(r["dates"]) if r.get("dates") else []
        except: r["dates"] = []
        emails.append(r)
        
    conn.close()
    return emails

def get_todays_emails_for_insights():
    """Fetches today's emails for generating insights (limit 50)."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        today = datetime.datetime.now().strftime("%Y-%m-%d")
        cur.execute("SELECT subject, priority, category, summary, dates FROM emails WHERE created_at LIKE ? ORDER BY id DESC LIMIT 50", (f"{today}%",))
        rows = cur.fetchall()
        if not rows:
             cur.execute("SELECT subject, priority, category, summary, dates FROM emails ORDER BY id DESC LIMIT 50")
             rows = cur.fetchall()
    except Exception:
        rows = []
    conn.close()
    return [dict(row) for row in rows]
