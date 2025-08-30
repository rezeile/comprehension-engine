"""
SQLAlchemy models for the Comprehension Engine.

This module defines the database schema for users, conversations,
and comprehension analysis data.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, Text, DateTime, ForeignKey, CheckConstraint, JSON, Index
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


# --- Adaptive Learning Tables ---

class Prompt(Base):
    """
    Versioned prompt content used to guide the tutoring assistant.

    Supports lineage via parent_prompt_id and activation state.
    """
    __tablename__ = "prompts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(Text, nullable=False)
    base_variant = Column(Text, nullable=True)
    content = Column(Text, nullable=False)
    # 'metadata' is reserved by SQLAlchemy's Declarative API; map to a safe attribute name
    prompt_metadata = Column("metadata", JSON, nullable=True)
    scope = Column(String(32), CheckConstraint("scope IN ('global','user','conversation','cohort')"), nullable=False, default="global")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(UUID(as_uuid=True), nullable=True)
    parent_prompt_id = Column(UUID(as_uuid=True), ForeignKey("prompts.id", ondelete="SET NULL"), nullable=True)
    is_active = Column(Boolean, nullable=False, default=False)

    # Relationships
    prompt_assignments = relationship("PromptAssignment", back_populates="prompt", cascade="all, delete-orphan")

    # Helpful composite index: (scope, is_active) to query active prompts by scope
    __table_args__ = (
        Index("ix_prompts_scope_is_active", "scope", "is_active"),
    )

    def __repr__(self) -> str:
        return f"<Prompt(id={self.id}, name='{self.name}', scope='{self.scope}', is_active={self.is_active})>"


class PromptAssignment(Base):
    """
    Assigns a prompt to a given scope (global, user, conversation, cohort future).

    Only one effective assignment per scope/target should typically be considered by the resolver.
    """
    __tablename__ = "prompt_assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    scope = Column(String(32), CheckConstraint("scope IN ('global','user','conversation','cohort')"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=True)
    prompt_id = Column(UUID(as_uuid=True), ForeignKey("prompts.id", ondelete="CASCADE"), nullable=False)
    effective_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    prompt = relationship("Prompt", back_populates="prompt_assignments")
    conversation = relationship("Conversation")

    # Convenience indexes for common lookup paths
    __table_args__ = (
        Index("ix_prompt_assignments_scope", "scope"),
        Index("ix_prompt_assignments_user_id", "user_id"),
        Index("ix_prompt_assignments_conversation_id", "conversation_id"),
    )

    def __repr__(self) -> str:
        return (
            f"<PromptAssignment(id={self.id}, scope='{self.scope}', user_id={self.user_id}, "
            f"conversation_id={self.conversation_id}, prompt_id={self.prompt_id})>"
        )


class LearningAnalysis(Base):
    """
    Stores the output of analysis over a conversation's voice transcript, plus features and
    optional suggestions that can inform prompt updates.
    """
    __tablename__ = "learning_analyses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    transcript = Column(JSON, nullable=False)
    features = Column(JSON, nullable=False)
    highlights = Column(JSON, nullable=True)
    connections = Column(JSON, nullable=True)
    prompt_suggestions = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User")
    conversation = relationship("Conversation")

    # Composite index for frequent joins/filters
    __table_args__ = (
        Index("ix_learning_analyses_user_conversation", "user_id", "conversation_id"),
    )

    def __repr__(self) -> str:
        return (
            f"<LearningAnalysis(id={self.id}, user_id={self.user_id}, conversation_id={self.conversation_id})>"
        )
