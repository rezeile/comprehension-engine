"""
SQLAlchemy models for the Comprehension Engine.

This module defines the database schema for users, conversations,
and comprehension analysis data.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, Text, DateTime, ForeignKey, CheckConstraint, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .connection import Base

class User(Base):
    """
    User model for storing user account information.
    
    Supports Google OAuth authentication and basic user data.
    """
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    google_id = Column(String(255), unique=True, nullable=True, index=True)
    avatar_url = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Relationships
    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<User(id={self.id}, email='{self.email}', name='{self.name}')>"

class Conversation(Base):
    """
    Conversation model for storing chat sessions.
    
    Groups related conversation turns together and tracks metadata.
    """
    __tablename__ = "conversations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=True)
    topic = Column(String(255), nullable=True)
    session_id = Column(String(255), nullable=True)  # For tracking voice sessions
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="conversations")
    turns = relationship("ConversationTurn", back_populates="conversation", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Conversation(id={self.id}, user_id={self.user_id}, title='{self.title}')>"

class ConversationTurn(Base):
    """
    Individual conversation turn model.
    
    Stores each user input, AI response, and comprehension analysis.
    """
    __tablename__ = "conversation_turns"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    turn_number = Column(Integer, nullable=False)  # Sequence number within conversation
    user_input = Column(Text, nullable=False)
    ai_response = Column(Text, nullable=False)
    
    # Comprehension analysis fields
    comprehension_score = Column(Integer, CheckConstraint('comprehension_score BETWEEN 1 AND 5'), nullable=True)
    comprehension_notes = Column(Text, nullable=True)
    comprehension_analysis_raw = Column(Text, nullable=True)  # Store raw Claude analysis
    
    # Performance and metadata
    response_time_ms = Column(Integer, nullable=True)  # Time to generate AI response
    voice_used = Column(String(100), nullable=True)  # Which ElevenLabs voice was used
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    extra_data = Column(JSON, nullable=True)  # Flexible field for additional data
    # Attachments associated with the user turn (images, etc.)
    attachments = Column(JSON, nullable=True)  # Array of attachment metadata dicts
    
    # Relationships
    conversation = relationship("Conversation", back_populates="turns")
    
    def __repr__(self):
        return f"<ConversationTurn(id={self.id}, conversation_id={self.conversation_id}, turn_number={self.turn_number})>"
