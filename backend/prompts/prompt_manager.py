"""
DB-aware prompt resolver facade.

Exposes get_prompt(task, mode, user_id, conversation_id, db=None) that:
- If PROMPTS_FROM_DB is true, resolves via PromptService with caching
- Else, returns the active in-memory prompt variant content

This does not affect the admin endpoints that operate on in-memory variants.
"""

from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from config import app_settings
from services import PromptService
from database.connection import SessionLocal
from .prompt_variants import prompt_manager as in_memory_manager


def get_prompt(
    *,
    task: Optional[str] = None,
    mode: Optional[str] = None,
    user_id: Optional[object] = None,
    conversation_id: Optional[object] = None,
    db: Optional[Session] = None,
) -> str:
    """
    Resolve the effective system prompt content for the given context.

    Args:
        task: logical task hint (e.g., "chat", "affect")
        mode: "text" or "voice" when relevant
        user_id: optional user UUID
        conversation_id: optional conversation UUID
        db: optional SQLAlchemy Session. If not provided and DB prompts are enabled,
            a short-lived session will be created for this call.
    """
    if not app_settings.prompts_from_db:
        return in_memory_manager.get_prompt(task=task or "chat", mode=mode or "text")

    if db is not None:
        resolver = PromptService(db)
        return resolver.get_effective_prompt_content(
            task=task, mode=mode, user_id=user_id, conversation_id=conversation_id
        )

    # Create a short-lived session if not provided
    session: Optional[Session] = None
    try:
        session = SessionLocal()
        resolver = PromptService(session)
        return resolver.get_effective_prompt_content(
            task=task, mode=mode, user_id=user_id, conversation_id=conversation_id
        )
    finally:
        try:
            if session is not None:
                session.close()
        except Exception:
            pass


