"""
Authentication module for the Comprehension Engine.

This module provides Google OAuth integration, JWT token management,
and authentication dependencies for protected routes.
"""

from .oauth import google_oauth, create_user_from_google
from .jwt_handler import create_access_token, create_refresh_token, verify_token
from .dependencies import get_current_user, get_current_active_user
from .schemas import UserResponse, TokenResponse

__all__ = [
    "google_oauth",
    "create_user_from_google", 
    "create_access_token",
    "create_refresh_token",
    "verify_token",
    "get_current_user",
    "get_current_active_user",
    "UserResponse",
    "TokenResponse"
]
