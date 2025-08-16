"""
Google OAuth integration for user authentication.

This module handles Google OAuth 2.0 flow, user information retrieval,
and user creation/updates in the database.
"""

import os
from datetime import datetime, timezone
from typing import Optional
from authlib.integrations.starlette_client import OAuth
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from database.models import User
from .schemas import GoogleUserInfo, UserCreate

# Load environment variables
load_dotenv()

# OAuth Configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
    print("Warning: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set. Google OAuth will not work.")

# Initialize OAuth
oauth = OAuth()

if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET:
    google_oauth = oauth.register(
        name='google',
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        authorize_url='https://accounts.google.com/o/oauth2/v2/auth',
        access_token_url='https://oauth2.googleapis.com/token',
        # Provide explicit OpenID Provider metadata to satisfy jwks_uri requirement
        server_metadata={
            'issuer': 'https://accounts.google.com',
            'authorization_endpoint': 'https://accounts.google.com/o/oauth2/v2/auth',
            'token_endpoint': 'https://oauth2.googleapis.com/token',
            'userinfo_endpoint': 'https://openidconnect.googleapis.com/v1/userinfo',
            'jwks_uri': 'https://www.googleapis.com/oauth2/v3/certs'
        },
        client_kwargs={
            # Avoid OpenID ID token parsing (which requires jwks_uri) by not requesting 'openid'
            'scope': 'email profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile'
        }
    )
else:
    google_oauth = None

def create_user_from_google(db: Session, google_user: GoogleUserInfo) -> User:
    """
    Create or update a user from Google OAuth information.
    
    Args:
        db: Database session
        google_user: Google user information
        
    Returns:
        User object (created or updated)
    """
    # Check if user already exists by Google ID
    existing_user = db.query(User).filter(User.google_id == google_user.id).first()
    
    if existing_user:
        # Update existing user information
        existing_user.name = google_user.name
        existing_user.email = google_user.email
        existing_user.avatar_url = google_user.picture
        # SQLAlchemy 2.0: avoid Engine.execute; set timestamp in app
        existing_user.last_login = datetime.now(timezone.utc)
        
        db.commit()
        db.refresh(existing_user)
        return existing_user
    
    # Check if user exists by email (in case they signed up differently before)
    existing_user_by_email = db.query(User).filter(User.email == google_user.email).first()
    
    if existing_user_by_email:
        # Link Google account to existing email user
        existing_user_by_email.google_id = google_user.id
        existing_user_by_email.name = google_user.name
        existing_user_by_email.avatar_url = google_user.picture
        existing_user_by_email.last_login = datetime.now(timezone.utc)
        
        db.commit()
        db.refresh(existing_user_by_email)
        return existing_user_by_email
    
    # Create new user
    user_data = UserCreate(
        email=google_user.email,
        name=google_user.name,
        google_id=google_user.id,
        avatar_url=google_user.picture
    )
    
    new_user = User(
        email=user_data.email,
        name=user_data.name,
        google_id=user_data.google_id,
        avatar_url=user_data.avatar_url
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user

async def get_google_user_info(access_token: str) -> Optional[GoogleUserInfo]:
    """
    Get user information from Google using access token.
    
    Args:
        access_token: Google OAuth access token
        
    Returns:
        Google user information if successful, None if failed
    """
    try:
        import httpx
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if response.status_code == 200:
                user_data = response.json()
                return GoogleUserInfo(
                    id=user_data["id"],
                    email=user_data["email"],
                    name=user_data["name"],
                    picture=user_data.get("picture"),
                    email_verified=user_data.get("verified_email", True)
                )
            else:
                print(f"Failed to get Google user info: {response.status_code}")
                return None
                
    except Exception as e:
        print(f"Error getting Google user info: {e}")
        return None
