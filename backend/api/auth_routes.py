"""
Authentication API routes.

This module provides endpoints for Google OAuth login, token refresh,
user information, and logout functionality.
"""

import os
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy.orm import Session
from datetime import timedelta

from database import get_db
from auth import (
    google_oauth, 
    create_user_from_google,
    create_access_token,
    create_refresh_token,
    verify_token,
    get_current_user,
    get_current_active_user
)
from auth.oauth import get_google_user_info
from auth.schemas import (
    TokenResponse,
    UserResponse,
    GoogleUserInfo,
    MobileGoogleExchangeRequest,
    MobileAppleExchangeRequest,
)
from auth.jwt_handler import ACCESS_TOKEN_EXPIRE_MINUTES

router = APIRouter(prefix="/api/auth", tags=["authentication"])

@router.get("/login")
async def login(request: Request):
    """
    Initiate Google OAuth login flow.
    
    Redirects user to Google OAuth consent screen.
    """
    if not google_oauth:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."
        )
    
    # Construct proper redirect URI
    # Prefer explicit public URL when running behind proxies (Railway, etc.)
    public_base = os.getenv("BACKEND_PUBLIC_URL", "").rstrip("/")
    if public_base:
        base_url = public_base
    else:
        base_url = str(request.base_url).rstrip('/')
        # Ensure we have a proper domain for OAuth
        if base_url == "http://" or base_url == "https://":
            base_url = "http://localhost:8000"  # Fallback for local development
    
    redirect_uri = f"{base_url}/api/auth/callback"
    
    return await google_oauth.authorize_redirect(request, redirect_uri)

@router.get("/callback")
async def auth_callback(request: Request, db: Session = Depends(get_db)):
    """
    Handle Google OAuth callback.
    
    Processes the OAuth response, creates/updates user, and returns tokens.
    """
    if not google_oauth:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth not configured"
        )
    
    try:
        print(f"Starting OAuth callback...")
        
        # Compute the same redirect_uri used during login
        public_base = os.getenv("BACKEND_PUBLIC_URL", "").rstrip("/")
        if public_base:
            base_url = public_base
        else:
            base_url = str(request.base_url).rstrip('/')
            if base_url == "http://" or base_url == "https://":
                base_url = "http://localhost:8000"
        redirect_uri = f"{base_url}/api/auth/callback"

        # Get access token from Google (explicitly pass redirect_uri to avoid mismatch behind proxies)
        print(f"Getting access token...")
        token = await google_oauth.authorize_access_token(request, redirect_uri=redirect_uri)
        print(f"Got token: {token.keys() if token else 'None'}")
        
        # Get user info from Google using the access token
        print(f"Getting user info...")
        user_info_response = await get_google_user_info(token['access_token'])
        
        if not user_info_response:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to get user information from Google"
            )
        
        google_user = user_info_response
        
        # Create or update user in database
        user = create_user_from_google(db, google_user)
        
        # Create JWT tokens
        access_token = create_access_token(
            data={"sub": str(user.id), "email": user.email}
        )
        refresh_token = create_refresh_token(
            data={"sub": str(user.id), "email": user.email}
        )

        # If mode=json, return tokens directly for easy testing without a frontend
        if request.query_params.get("mode") == "json":
            return TokenResponse(
                access_token=access_token,
                refresh_token=refresh_token,
                token_type="bearer",
                expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60
            )

        # Use configured FRONTEND_URL to avoid state mismatches
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        
        # Set httpOnly cookies and redirect to frontend root
        response = RedirectResponse(url=f"{frontend_url}/")
        # Cross-site cookies for prod; same-site for dev
        is_local = frontend_url.startswith("http://localhost") or frontend_url.startswith("http://127.0.0.1")
        if is_local:
            cookie_kwargs = {"path": "/", "samesite": "lax", "httponly": True}
        else:
            cookie_kwargs = {"path": "/", "samesite": "none", "secure": True, "httponly": True}
        response.set_cookie("ce_access_token", access_token, **cookie_kwargs)
        response.set_cookie("ce_refresh_token", refresh_token, **cookie_kwargs)
        return response
        
    except Exception as e:
        # Log full error for debugging
        import traceback
        traceback.print_exc()
        print(f"OAuth callback error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OAuth authentication failed"
        )

@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    refresh_token: str,
    db: Session = Depends(get_db)
):
    """
    Refresh access token using refresh token.
    
    Args:
        refresh_token: Valid refresh token
        
    Returns:
        New access and refresh tokens
    """
    # Verify refresh token
    payload = verify_token(refresh_token, expected_type="refresh")
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    user_id = payload.get("sub")
    email = payload.get("email")
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token payload"
        )
    
    # Verify user still exists and is active
    from database.models import User
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    
    # Create new tokens
    new_access_token = create_access_token(
        data={"sub": user_id, "email": email}
    )
    new_refresh_token = create_refresh_token(
        data={"sub": user_id, "email": email}
    )
    
    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user = Depends(get_current_active_user)):
    """
    Get current authenticated user information.
    
    Returns:
        Current user data
    """
    return current_user

@router.post("/logout")
async def logout():
    """
    Logout endpoint.
    
    Clears authentication cookies so subsequent requests are unauthenticated.
    """
    response = JSONResponse({"message": "Successfully logged out"})
    # Remove access/refresh cookies
    response.delete_cookie("ce_access_token", path="/")
    response.delete_cookie("ce_refresh_token", path="/")
    return response

@router.get("/status")
async def auth_status(request: Request):
    """
    Get authentication system status.
    
    Returns information about OAuth configuration and system health.
    """
    base_url = str(request.base_url).rstrip('/')
    if base_url == "http://" or base_url == "https://":
        base_url = "http://localhost:8000"
    
    return {
        "google_oauth_configured": google_oauth is not None,
        "google_client_id": os.getenv("GOOGLE_CLIENT_ID", "")[:10] + "..." if os.getenv("GOOGLE_CLIENT_ID") else None,
        "jwt_configured": bool(os.getenv("SECRET_KEY")),
        "base_url": base_url,
        "redirect_uri": f"{base_url}/api/auth/callback",
        "frontend_url": os.getenv("FRONTEND_URL", "http://localhost:3000"),
        "status": "healthy"
    }

@router.get("/session")
async def auth_session(request: Request):
    """
    Return diagnostics about the current browser session from the backend's perspective.
    Does not expose token values; only indicates presence and basic token validity.
    """
    has_access_cookie = "ce_access_token" in request.cookies
    has_refresh_cookie = "ce_refresh_token" in request.cookies
    auth_header_present = bool(request.headers.get("authorization"))

    token_valid = None
    token_payload_preview = None
    if has_access_cookie:
        try:
            payload = verify_token(request.cookies.get("ce_access_token"), expected_type="access")
            if payload:
                token_valid = True
                token_payload_preview = {
                    "sub": payload.get("sub"),
                    "email": payload.get("email"),
                    "exp": payload.get("exp"),
                }
            else:
                token_valid = False
        except Exception:
            token_valid = False

    return {
        "cookies": {
            "ce_access_token_present": has_access_cookie,
            "ce_refresh_token_present": has_refresh_cookie,
        },
        "auth_header_present": auth_header_present,
        "access_token_valid": token_valid,
        "access_token_payload_preview": token_payload_preview,
    }

# Dev-only login endpoint to mint tokens without Google OAuth (guarded by env flag)
@router.post("/dev-login", response_model=TokenResponse)
async def dev_login(email: str, name: Optional[str] = None, db: Session = Depends(get_db)):
    allow_dev = os.getenv("ALLOW_DEV_LOGIN", "false").lower() == "true"
    if not allow_dev:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Dev login disabled")

    from database.models import User

    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(email=email, name=name or email.split("@")[0], is_active=True)
        db.add(user)
        db.commit()
        db.refresh(user)

    access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
    refresh_token = create_refresh_token(data={"sub": str(user.id), "email": user.email})

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

# ---- Mobile token exchange endpoints ----

@router.post("/mobile/google", response_model=TokenResponse)
async def mobile_google_exchange(payload: MobileGoogleExchangeRequest, db: Session = Depends(get_db)):
    """
    Exchange a Google access token (obtained natively on iOS/Android) for app JWTs.

    This avoids cookie/redirect flows and keeps mobile sessions independent of web.
    """
    # Validate with Google and get profile
    google_user: Optional[GoogleUserInfo] = await get_google_user_info(payload.access_token)
    if not google_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Google access token")

    # Upsert user
    user = create_user_from_google(db, google_user)

    # Issue tokens
    access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
    refresh_token = create_refresh_token(data={"sub": str(user.id), "email": user.email})

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )

@router.post("/mobile/apple", response_model=TokenResponse)
async def mobile_apple_exchange(_: MobileAppleExchangeRequest):
    """
    Placeholder for Apple Sign In token exchange.
    Implement verification against Apple JWKs and user linking in a follow-up.
    """
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Apple mobile exchange not implemented yet")
