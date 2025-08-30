"""
Prompt service: CRUD operations and resolution logic for DB-backed prompts.

This module encapsulates:
- Creating and listing prompts and assignments
- Resolving the effective prompt content given optional user/conversation context
- A small in-process TTL cache to reduce database hits

It integrates with feature flags in config.app_settings and falls back to the
in-memory prompt manager when DB-backed prompts are disabled or no assignment exists.
"""

from __future__ import annotations

import time
from typing import Optional, Dict, Any, Tuple
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import and_, desc

from database.models import Prompt, PromptAssignment
from config import app_settings
from prompts import prompt_manager


class _TtlCache:
    """Simple in-process TTL cache for resolved prompt content."""

    def __init__(self, ttl_seconds: int) -> None:
        self.ttl_seconds = ttl_seconds
        self._store: Dict[str, Tuple[str, float]] = {}

    def _now(self) -> float:
        return time.time()

    def get(self, key: str) -> Optional[str]:
        entry = self._store.get(key)
        if not entry:
            return None
        value, expires_at = entry
        if self._now() >= expires_at:
            # Expired
            try:
                del self._store[key]
            except Exception:
                pass
            return None
        return value

    def set(self, key: str, value: str) -> None:
        self._store[key] = (value, self._now() + max(1, int(self.ttl_seconds)))

    def invalidate_prefix(self, prefix: str) -> None:
        keys_to_delete = [k for k in self._store.keys() if k.startswith(prefix)]
        for k in keys_to_delete:
            try:
                del self._store[k]
            except Exception:
                pass


class PromptService:
    """
    Service for DB-backed prompt operations and resolution.

    Usage:
        service = PromptService(db)
        content = service.get_effective_prompt_content(task="chat", mode="voice", user_id=uid, conversation_id=cid)
    """

    def __init__(self, db: Session, ttl_seconds: Optional[int] = None) -> None:
        self.db = db
        ttl = int(ttl_seconds if ttl_seconds is not None else app_settings.prompt_cache_ttl_seconds)
        self._cache = _TtlCache(ttl)

    # -----------------
    # CRUD: Prompts
    # -----------------
    def create_prompt(
        self,
        name: str,
        content: str,
        *,
        base_variant: Optional[str] = None,
        scope: str = "global",
        created_by: Optional[UUID] = None,
        parent_prompt_id: Optional[UUID] = None,
        metadata: Optional[Dict[str, Any]] = None,
        is_active: bool = False,
    ) -> Prompt:
        prompt = Prompt(
            name=name,
            base_variant=base_variant,
            content=content,
            prompt_metadata=metadata,
            scope=scope,
            created_by=created_by,
            parent_prompt_id=parent_prompt_id,
            is_active=is_active,
        )
        self.db.add(prompt)
        self.db.commit()
        self.db.refresh(prompt)
        return prompt

    def set_prompt_active(self, prompt_id: UUID, active: bool = True) -> Optional[Prompt]:
        prompt: Optional[Prompt] = self.db.query(Prompt).filter(Prompt.id == prompt_id).first()
        if not prompt:
            return None
        prompt.is_active = bool(active)
        self.db.add(prompt)
        self.db.commit()
        self.db.refresh(prompt)
        # Invalidate cache broadly since content may change resolution
        self._cache.invalidate_prefix("")
        return prompt

    def get_prompt_by_id(self, prompt_id: UUID) -> Optional[Prompt]:
        return self.db.query(Prompt).filter(Prompt.id == prompt_id).first()

    # -----------------
    # CRUD: Assignments
    # -----------------
    def assign_prompt(
        self,
        *,
        prompt_id: UUID,
        scope: str,
        user_id: Optional[UUID] = None,
        conversation_id: Optional[UUID] = None,
    ) -> PromptAssignment:
        assignment = PromptAssignment(
            scope=scope,
            user_id=user_id,
            conversation_id=conversation_id,
            prompt_id=prompt_id,
        )
        # Ensure strictly increasing effective_at for deterministic ordering across tight inserts
        assignment.effective_at = datetime.now(timezone.utc)
        self.db.add(assignment)
        self.db.commit()
        self.db.refresh(assignment)
        # Invalidate relevant cache keys
        if conversation_id:
            self._cache.invalidate_prefix(f"conv:{conversation_id}|")
        if user_id:
            self._cache.invalidate_prefix(f"user:{user_id}|")
        self._cache.invalidate_prefix("global|")
        return assignment

    # -----------------
    # Resolution
    # -----------------
    def _cache_key(self, task: Optional[str], mode: Optional[str], user_id: Optional[UUID], conversation_id: Optional[UUID]) -> str:
        task_key = task or "_"
        mode_key = mode or "_"
        ukey = f"user:{user_id}" if user_id else "user:_"
        ckey = f"conv:{conversation_id}" if conversation_id else "conv:_"
        return f"{ckey}|{ukey}|task:{task_key}|mode:{mode_key}"

    def _resolve_assigned_prompt(self, user_id: Optional[UUID], conversation_id: Optional[UUID]) -> Optional[Prompt]:
        """
        Resolve assigned prompt precedence: conversation → user → global.
        Only returns prompts where Prompt.is_active is True.
        """
        # conversation-level
        if conversation_id is not None:
            conv_assignment = (
                self.db.query(PromptAssignment)
                .join(Prompt, Prompt.id == PromptAssignment.prompt_id)
                .filter(
                    and_(
                        PromptAssignment.scope == "conversation",
                        PromptAssignment.conversation_id == conversation_id,
                        Prompt.is_active.is_(True),
                    )
                )
                .order_by(desc(PromptAssignment.effective_at))
                .first()
            )
            if conv_assignment:
                return self.db.query(Prompt).filter(Prompt.id == conv_assignment.prompt_id).first()

        # user-level
        if user_id is not None:
            user_assignment = (
                self.db.query(PromptAssignment)
                .join(Prompt, Prompt.id == PromptAssignment.prompt_id)
                .filter(
                    and_(
                        PromptAssignment.scope == "user",
                        PromptAssignment.user_id == user_id,
                        Prompt.is_active.is_(True),
                    )
                )
                .order_by(desc(PromptAssignment.effective_at))
                .first()
            )
            if user_assignment:
                return self.db.query(Prompt).filter(Prompt.id == user_assignment.prompt_id).first()

        # global-level
        global_assignment = (
            self.db.query(PromptAssignment)
            .join(Prompt, Prompt.id == PromptAssignment.prompt_id)
            .filter(
                and_(
                    PromptAssignment.scope == "global",
                    Prompt.is_active.is_(True),
                )
            )
            .order_by(desc(PromptAssignment.effective_at))
            .first()
        )
        if global_assignment:
            return self.db.query(Prompt).filter(Prompt.id == global_assignment.prompt_id).first()

        return None

    def get_effective_prompt_content(
        self,
        *,
        task: Optional[str] = None,
        mode: Optional[str] = None,
        user_id: Optional[UUID] = None,
        conversation_id: Optional[UUID] = None,
    ) -> str:
        """
        Return the effective prompt content.
        - If PROMPTS_FROM_DB=false: returns in-memory variant via prompt_manager.
        - Else: try DB resolution with cache; fallback to in-memory if none found.
        """
        if not app_settings.prompts_from_db:
            return prompt_manager.get_prompt(task=task or "chat", mode=mode or "text")

        key = self._cache_key(task, mode, user_id, conversation_id)
        cached = self._cache.get(key)
        if cached is not None:
            return cached

        prompt_row = self._resolve_assigned_prompt(user_id=user_id, conversation_id=conversation_id)
        if prompt_row and isinstance(prompt_row.content, str) and prompt_row.content.strip():
            self._cache.set(key, prompt_row.content)
            return prompt_row.content

        # Fallback to in-memory variant
        content = prompt_manager.get_prompt(task=task or "chat", mode=mode or "text")
        self._cache.set(key, content)
        return content


