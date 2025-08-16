"""
Database module for the Comprehension Engine.

This module provides database connection, models, and utilities for managing
user data, conversations, and comprehension analytics.
"""

from .connection import get_db, engine, SessionLocal
from .models import User, Conversation, ConversationTurn

__all__ = [
    "get_db",
    "engine", 
    "SessionLocal",
    "User",
    "Conversation", 
    "ConversationTurn"
]
