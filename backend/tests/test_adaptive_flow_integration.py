"""
Integration test for adaptive flow at the service layer:
1) Create voice conversation turns
2) Run analysis to persist a learning_analyses row
3) Create a personalized prompt and assign it to the user
4) Resolve prompt via PromptService and ensure precedence works

Note: This is not an API test; it exercises services end-to-end with SQLite.
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database.connection import Base
from database.models import User, Conversation, ConversationTurn
from services import LearningAnalysisService, PromptService
from config import app_settings


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


def test_adaptive_learning_flow(db_session, monkeypatch):
    # Enable DB prompts path
    monkeypatch.setattr(app_settings, "prompts_from_db", True, raising=False)

    # 1) Seed user and conversation with a voice turn
    user = User(email="flow@test.com", name="Flow User", is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    conv = Conversation(user_id=user.id, title="Flow Convo", is_active=True)
    db_session.add(conv)
    db_session.commit()
    db_session.refresh(conv)

    t1 = ConversationTurn(
        conversation_id=conv.id,
        turn_number=1,
        user_input="Explain derivatives",
        ai_response="Derivatives measure...",
        response_time_ms=120,
        voice_used="voice-1",
    )
    db_session.add(t1)
    db_session.commit()

    # 2) Run analysis
    la = LearningAnalysisService(db_session)
    transcript = la.get_voice_transcript(conv.id)
    features = la.analyze_transcript(transcript)
    row = la.persist_analysis(user_id=user.id, conversation_id=conv.id, transcript=transcript, features=features)
    assert row is not None

    # 3) Create personalized prompt and assign to user
    ps = PromptService(db_session, ttl_seconds=1)
    personalized = ps.create_prompt(
        name=f"user_{user.id}_v1",
        content="PERSONALIZED: Use analogy-first and ask a question.",
        scope="user",
        is_active=True,
    )
    ps.assign_prompt(prompt_id=personalized.id, scope="user", user_id=user.id)

    # 4) Resolve prompt and confirm personalized content
    resolved = ps.get_effective_prompt_content(user_id=user.id, conversation_id=conv.id)
    assert "PERSONALIZED" in resolved

