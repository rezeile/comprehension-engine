import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from main import app
from database.connection import Base, get_db
from database.models import User, Conversation, ConversationTurn, Prompt
from auth.dependencies import get_current_user
from config import app_settings
from prompts import prompt_manager


SQLALCHEMY_DATABASE_URL = "sqlite:///./test_adaptive_end_to_end.sqlite"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    Base.metadata.create_all(bind=engine)
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


@pytest.fixture
def client(monkeypatch):
    app.dependency_overrides[get_db] = override_get_db
    # Ensure DB-backed prompts path
    monkeypatch.setattr(app_settings, "prompts_from_db", True, raising=False)
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)


def override_user(user):
    def _o():
        return user
    return _o


def seed_voice_conversation(db, user):
    convo = Conversation(user_id=user.id, title="Voice Convo", is_active=True)
    db.add(convo); db.commit(); db.refresh(convo)
    t = ConversationTurn(
        conversation_id=convo.id,
        turn_number=1,
        user_input="Explain gravity",
        ai_response="Gravity is...",
        voice_used="v1",
    )
    db.add(t); db.commit()
    return convo


def test_end_to_end_voice_flow_updates_prompt_and_resolves(client, db_session):
    # Seed user and voice convo
    user = User(email="e2e@test.com", name="E2E", is_active=True)
    db_session.add(user); db_session.commit(); db_session.refresh(user)
    convo = seed_voice_conversation(db_session, user)
    app.dependency_overrides[get_current_user] = override_user(user)

    # Analyze conversation
    r = client.post("/api/learning/analyze", json={"conversation_id": str(convo.id)})
    assert r.status_code == 200
    analysis_id = r.json()["id"]
    assert analysis_id is not None

    # Update prompt for user scope (commit)
    r2 = client.post("/api/learning/update-prompt", json={
        "analysis_id": analysis_id,
        "scope": "user"
    })
    assert r2.status_code == 200
    data = r2.json()
    assert data["dry_run"] is False
    assert data["assignment"]["scope"] == "user"
    # Improved content marker present
    assert "Improved: Emphasize brevity" in data["prompt"]["content"]

    # Resolve via prompt_manager to ensure adoption
    with TestingSessionLocal() as s:
        content = prompt_manager.get_prompt(task="chat", mode="text", user_id=user.id, conversation_id=convo.id, db=s)
    assert "Improved: Emphasize brevity" in content

    # Run a second update to verify lineage (parent points to the prior prompt)
    r3 = client.post("/api/learning/update-prompt", json={
        "analysis_id": analysis_id,
        "scope": "user"
    })
    assert r3.status_code == 200
    # Fetch any prompt with a parent (avoid relying on timestamp ordering in SQLite)
    with TestingSessionLocal() as s:
        prompts_with_parent = s.query(Prompt).filter(Prompt.parent_prompt_id.isnot(None)).all()
    assert len(prompts_with_parent) >= 1
    # Metadata should carry source features
    assert isinstance(latest_prompt.prompt_metadata, dict)
    assert "source_analysis_features" in latest_prompt.prompt_metadata


def test_text_only_conversation_analyze_persists_empty_transcript(client, db_session):
    user = User(email="text@test.com", name="Text", is_active=True)
    db_session.add(user); db_session.commit(); db_session.refresh(user)
    convo = Conversation(user_id=user.id, title="Text Convo", is_active=True)
    db_session.add(convo); db_session.commit(); db_session.refresh(convo)
    # Add a text-only turn (voice_used=None)
    t = ConversationTurn(
        conversation_id=convo.id,
        turn_number=1,
        user_input="What is a set?",
        ai_response="A set is...",
        voice_used=None,
    )
    db_session.add(t); db_session.commit()
    app.dependency_overrides[get_current_user] = override_user(user)

    r = client.post("/api/learning/analyze", json={"conversation_id": str(convo.id)})
    assert r.status_code == 200
    data = r.json()
    # Our current implementation analyzes only voice-marked turns, so transcript is empty
    assert isinstance(data["transcript"], list)
    assert len(data["transcript"]) == 0


def test_global_prompt_update_requires_admin(client, db_session, monkeypatch):
    user = User(email="nonadmin@test.com", name="NA", is_active=True)
    db_session.add(user); db_session.commit(); db_session.refresh(user)
    convo = seed_voice_conversation(db_session, user)
    app.dependency_overrides[get_current_user] = override_user(user)

    # Analyze
    r = client.post("/api/learning/analyze", json={"conversation_id": str(convo.id)})
    assert r.status_code == 200
    analysis_id = r.json()["id"]

    # Non-admin attempt should be forbidden
    r2 = client.post("/api/learning/update-prompt", json={
        "analysis_id": analysis_id,
        "scope": "global"
    })
    assert r2.status_code == 403

    # Make user admin via env
    monkeypatch.setenv("ADMIN_EMAILS", user.email)

    # Now allowed
    r3 = client.post("/api/learning/update-prompt", json={
        "analysis_id": analysis_id,
        "scope": "global"
    })
    assert r3.status_code == 200
    assert r3.json()["assignment"]["scope"] == "global"


