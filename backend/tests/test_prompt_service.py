"""
Unit tests for PromptService covering CRUD, precedence resolution, caching, and fallbacks.
"""

import time
import pytest
from uuid import uuid4
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database.connection import Base
from database.models import User, Conversation, Prompt, PromptAssignment
from services.prompt_service import PromptService
from config import app_settings


# In-memory SQLite for unit tests
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def sample_user(db_session):
    user = User(email="p@test.com", name="Prompt Tester", is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def sample_conversation(db_session, sample_user):
    conv = Conversation(user_id=sample_user.id, title="Prompt Test Conversation", is_active=True)
    db_session.add(conv)
    db_session.commit()
    db_session.refresh(conv)
    return conv


class TestPromptService:
    def test_fallback_to_in_memory_when_disabled(self, db_session, sample_user, sample_conversation, monkeypatch):
        # Ensure DB prompts disabled
        monkeypatch.setattr(app_settings, "prompts_from_db", False, raising=False)
        svc = PromptService(db_session, ttl_seconds=10)
        content = svc.get_effective_prompt_content(task="chat", mode="text", user_id=sample_user.id, conversation_id=sample_conversation.id)
        assert isinstance(content, str) and len(content) > 0

    def test_create_prompt_and_assignment_user_scope(self, db_session, sample_user, monkeypatch):
        # Enable DB prompts
        monkeypatch.setattr(app_settings, "prompts_from_db", True, raising=False)
        monkeypatch.setattr(app_settings, "prompt_cache_ttl_seconds", 60, raising=False)
        svc = PromptService(db_session)

        p = svc.create_prompt(
            name="adaptive_user_prompt_v1",
            content="SYSTEM: Be concise and ask clarifying questions.",
            scope="user",
            created_by=None,
            is_active=True,
        )
        svc.assign_prompt(prompt_id=p.id, scope="user", user_id=sample_user.id)

        resolved = svc.get_effective_prompt_content(task="chat", mode="voice", user_id=sample_user.id, conversation_id=None)
        assert "Be concise" in resolved

    def test_precedence_conversation_over_user_and_global(self, db_session, sample_user, sample_conversation, monkeypatch):
        monkeypatch.setattr(app_settings, "prompts_from_db", True, raising=False)
        svc = PromptService(db_session)

        # Global prompt
        p_global = svc.create_prompt(name="global_v1", content="GLOBAL PROMPT", scope="global", is_active=True)
        svc.assign_prompt(prompt_id=p_global.id, scope="global")

        # User prompt
        p_user = svc.create_prompt(name="user_v1", content="USER PROMPT", scope="user", is_active=True)
        svc.assign_prompt(prompt_id=p_user.id, scope="user", user_id=sample_user.id)

        # Conversation prompt (takes precedence)
        p_conv = svc.create_prompt(name="conv_v1", content="CONVERSATION PROMPT", scope="conversation", is_active=True)
        svc.assign_prompt(prompt_id=p_conv.id, scope="conversation", conversation_id=sample_conversation.id)

        content = svc.get_effective_prompt_content(user_id=sample_user.id, conversation_id=sample_conversation.id)
        assert content == "CONVERSATION PROMPT"

    def test_ttl_cache_and_invalidation(self, db_session, sample_user, monkeypatch):
        monkeypatch.setattr(app_settings, "prompts_from_db", True, raising=False)
        svc = PromptService(db_session, ttl_seconds=1)

        p1 = svc.create_prompt(name="u1_v1", content="V1", scope="user", is_active=True)
        svc.assign_prompt(prompt_id=p1.id, scope="user", user_id=sample_user.id)
        c1 = svc.get_effective_prompt_content(user_id=sample_user.id)
        assert c1 == "V1"

        # Change assignment to a new prompt
        p2 = svc.create_prompt(name="u1_v2", content="V2", scope="user", is_active=True)
        svc.assign_prompt(prompt_id=p2.id, scope="user", user_id=sample_user.id)

        # Cache still returns old within TTL
        c_cached = svc.get_effective_prompt_content(user_id=sample_user.id)
        assert c_cached == "V1"

        # Wait for TTL to expire
        time.sleep(1.1)
        c2 = svc.get_effective_prompt_content(user_id=sample_user.id)
        assert c2 == "V2"

