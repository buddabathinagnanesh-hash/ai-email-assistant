import os
from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from dotenv import load_dotenv

load_dotenv()

os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

router = APIRouter(prefix="/auth", tags=["auth"])

CLIENT_ID = os.environ.get("CLIENT_ID")
CLIENT_SECRET = os.environ.get("CLIENT_SECRET")

print("CLIENT_ID:", CLIENT_ID)
print("CLIENT_SECRET exists:", bool(CLIENT_SECRET))

if not CLIENT_ID or not CLIENT_SECRET:
    raise ValueError("Missing CLIENT_ID or CLIENT_SECRET")

API_URL = os.environ.get("API_URL", "http://localhost:8000").rstrip("/")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://ai-email-assistant-w7yo.vercel.app").rstrip("/")
REDIRECT_URI = "https://ai-email-assistant-1-wn0u.onrender.com/auth/callback"

def get_flow():
    return Flow.from_client_config(
        {
            "web": {
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "redirect_uris": [REDIRECT_URI],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=[
            "https://www.googleapis.com/auth/calendar.events",
            "https://www.googleapis.com/auth/gmail.readonly"
        ]
    )

@router.get("/login")
def auth_login():
    """Redirect user to Google OAuth login."""
    print("OAuth login initiated...")
    flow = get_flow()
    flow.redirect_uri = REDIRECT_URI
    
    # We set code_challenge=None to explicitly disable PKCE so we can keep the flow stateless
    auth_url, _ = flow.authorization_url(prompt='consent', state='dummy_state', code_challenge=None)
    
    return RedirectResponse(url=auth_url)

@router.get("/callback")
def auth_callback(request: Request):
    """Receive code, exchange for token, store in memory, return success."""
    code = request.query_params.get("code")
    error = request.query_params.get("error")
    
    if error:
        return {"error": f"Google returned error: {error}"}
    if not code:
        return {"error": "Missing code in callback request"}
        
    print("OAuth callback received code:", code[:10] + "...")
    flow = get_flow()
    flow.redirect_uri = REDIRECT_URI
    
    try:
        # Fetch token using the code received from Google
        flow.fetch_token(code=code)
        
        # Save credentials permanently to /tmp/token.json for Render compatibility
        with open("/tmp/token.json", "w") as f:
            f.write(flow.credentials.to_json())
        
        return RedirectResponse(url=f"{FRONTEND_URL}?connected=1")
    except Exception as e:
        return {"error": f"Authentication failed: {str(e)}"}
