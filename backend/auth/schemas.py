"""
Pydantic schemas for authentication data structures.
"""

from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from uuid import UUID

class UserBase(BaseModel):
    """Base user schema with common fields"""
    email: EmailStr
    name: str
    avatar_url: Optional[str] = None

class UserCreate(UserBase):
    """Schema for creating a new user"""
    google_id: str

class UserResponse(UserBase):
    """Schema for user data in API responses"""
    id: UUID
    created_at: datetime
    last_login: Optional[datetime] = None
    is_active: bool

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    """Schema for authentication token response"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds

class TokenData(BaseModel):
    """Schema for JWT token payload data"""
    user_id: Optional[str] = None
    email: Optional[str] = None

class GoogleUserInfo(BaseModel):
    """Schema for Google OAuth user information"""
    id: str
    email: str
    name: str
    picture: Optional[str] = None
    email_verified: bool = True
