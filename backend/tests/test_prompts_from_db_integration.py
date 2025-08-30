"""
Integration tests for DB-backed prompt resolution wiring in handlers.
"""

import pytest
from uuid import uuid4
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from unittest.mock import patch, Mock

from main import app
from database.connection import Base, get_db
from database.models import User, Conversation
from config import app_settings


SQLALCHEMY_DATABASE_URL = "sqlite:///./test_prompts_db.sqlite"
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


@pytest.fixture
def sample_user(db_session):
    user = User(email="dbprompt@test.com", name="DB Prompt User", is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def override_user(user):
    def _o():
        return user
    return _o


@patch('main.client')
def test_handlers_use_db_prompt_when_enabled(mock_anthropic_client, client, db_session, sample_user, monkeypatch):
    # Enable DB prompts
    monkeypatch.setattr(app_settings, "prompts_from_db", True, raising=False)

    # Seed a conversation and ensure resolve call doesn't error
    convo = Conversation(user_id=sample_user.id, title="T", is_active=True)
    db_session.add(convo)
    db_session.commit()

    app.dependency_overrides[__import__('auth.dependencies', fromlist=['get_current_user']).get_current_user] = override_user(sample_user)

    mock_response = Mock()
    mock_response.content = [Mock(text="hello")]
    mock_anthropic_client.messages.create.return_value = mock_response

    resp = client.post("/api/chat", json={"message": "hi", "conversation_id": str(convo.id)})
    assert resp.status_code == 200
    data = resp.json()
    assert "response" in data

