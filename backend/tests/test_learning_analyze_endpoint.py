import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from uuid import uuid4
from unittest.mock import patch

from main import app
from database.connection import Base, get_db
from database.models import User, Conversation, ConversationTurn
from auth.dependencies import get_current_user
from config import app_settings


SQLALCHEMY_DATABASE_URL = "sqlite:///./test_learning_analyze.sqlite"
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
def client():
    app.dependency_overrides[get_db] = override_get_db
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
    convo = Conversation(user_id=user.id, title="Voice", is_active=True)
    db.add(convo)
    db.commit()
    db.refresh(convo)
    t1 = ConversationTurn(
        conversation_id=convo.id,
        turn_number=1,
        user_input="Explain derivatives",
        ai_response="Derivatives measure rate of change.",
        response_time_ms=100,
        voice_used="v1",
    )
    db.add(t1)
    db.commit()
    return convo


@patch('main.app_settings')
def test_analyze_persists_when_enabled(mock_settings, client, db_session):
    mock_settings.adaptive_learning_enabled = True
    user = User(email="an@test.com", name="A N", is_active=True)
    db_session.add(user); db_session.commit(); db_session.refresh(user)
    convo = seed_voice_conversation(db_session, user)
    app.dependency_overrides[get_current_user] = override_user(user)

    r = client.post("/api/learning/analyze", json={"conversation_id": str(convo.id)})
    assert r.status_code == 200
    data = r.json()
    assert data["conversation_id"] == str(convo.id)
    assert data["user_id"] == str(user.id)
    assert isinstance(data["transcript"], list)


@patch('main.app_settings')
def test_analyze_dry_run(mock_settings, client, db_session):
    mock_settings.adaptive_learning_enabled = True
    user = User(email="dry@test.com", name="Dry", is_active=True)
    db_session.add(user); db_session.commit(); db_session.refresh(user)
    convo = seed_voice_conversation(db_session, user)
    app.dependency_overrides[get_current_user] = override_user(user)
    r = client.post("/api/learning/analyze", json={"conversation_id": str(convo.id), "dry_run": True})
    assert r.status_code == 200
    data = r.json()
    # Dry run should not have an id
    assert data["id"] is None


@patch('main.app_settings')
def test_analyze_forbidden_other_user(mock_settings, client, db_session):
    mock_settings.adaptive_learning_enabled = True
    user1 = User(email="u1@test.com", name="U1", is_active=True)
    user2 = User(email="u2@test.com", name="U2", is_active=True)
    db_session.add_all([user1, user2]); db_session.commit()
    db_session.refresh(user1); db_session.refresh(user2)
    convo = seed_voice_conversation(db_session, user2)
    app.dependency_overrides[get_current_user] = override_user(user1)
    r = client.post("/api/learning/analyze", json={"conversation_id": str(convo.id)})
    assert r.status_code == 403

