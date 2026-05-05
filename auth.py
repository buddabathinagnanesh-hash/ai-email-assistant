import os
from fastapi import APIRouter
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow

os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

router = APIRouter(prefix="/auth", tags=["auth"])

API_URL = os.environ.get("API_URL", "http://localhost:8000").rstrip("/")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173").rstrip("/")
REDIRECT_URI = f"{API_URL}/auth/callback"

def get_flow():
    return Flow.from_client_secrets_file(
        "credentials.json",
        scopes=[
            "https://www.googleapis.com/auth/calendar",
            "https://www.googleapis.com/auth/gmail.readonly"
        ]
    )

@router.get("/google")
def auth_google():
    """Generate auth URL and return it as JSON."""
    flow = get_flow()
    flow.redirect_uri = REDIRECT_URI
    
    # We set code_challenge=None to explicitly disable PKCE so we can keep the flow stateless
    auth_url, _ = flow.authorization_url(prompt='consent', state='dummy_state', code_challenge=None)
    
    return {"auth_url": auth_url}

@router.get("/callback")
def auth_callback(code: str):
    """Receive code, exchange for token, store in memory, return success."""
    flow = get_flow()
    flow.redirect_uri = REDIRECT_URI
    
    try:
        # Fetch token using the code received from Google
        flow.fetch_token(code=code)
        
        # Save credentials permanently
        with open("token.json", "w") as f:
            f.write(flow.credentials.to_json())
        
        return RedirectResponse(url=f"{FRONTEND_URL}?connected=1")
    except Exception as e:
        return {"error": f"Authentication failed: {str(e)}"}
