import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import patch

from main import app
from database.connection import Base, get_db
from database.models import User, Conversation, ConversationTurn, LearningAnalysis
from auth.dependencies import get_current_user


SQLALCHEMY_DATABASE_URL = "sqlite:///./test_update_prompt.sqlite"
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


def seed_analysis(db, user):
    convo = Conversation(user_id=user.id, title="c", is_active=True)
    db.add(convo); db.commit(); db.refresh(convo)
    t = ConversationTurn(
        conversation_id=convo.id,
        turn_number=1,
        user_input="u",
        ai_response="a",
        voice_used="v",
    )
    db.add(t); db.commit()
    la = LearningAnalysis(
        user_id=user.id,
        conversation_id=convo.id,
        transcript=[{"turn_number": 1, "role": "user", "text": "u", "timestamp": None}],
        features={"learning_style_patterns": ["compact"]},
    )
    db.add(la); db.commit(); db.refresh(la)
    return la


@patch('main.app_settings')
def test_update_prompt_dry_run_user_scope(mock_settings, client, db_session):
    mock_settings.adaptive_learning_enabled = True
    user = User(email="up@test.com", name="UP", is_active=True)
    db_session.add(user); db_session.commit(); db_session.refresh(user)
    la = seed_analysis(db_session, user)
    app.dependency_overrides[get_current_user] = override_user(user)

    r = client.post("/api/learning/update-prompt", json={
        "analysis_id": str(la.id),
        "scope": "user",
        "dry_run": True
    })
    assert r.status_code == 200
    data = r.json()
    assert data["dry_run"] is True
    assert data["prompt"]["scope"] == "user"


@patch('main.app_settings')
def test_update_prompt_commit_user_scope(mock_settings, client, db_session):
    mock_settings.adaptive_learning_enabled = True
    user = User(email="up2@test.com", name="UP2", is_active=True)
    db_session.add(user); db_session.commit(); db_session.refresh(user)
    la = seed_analysis(db_session, user)
    app.dependency_overrides[get_current_user] = override_user(user)

    r = client.post("/api/learning/update-prompt", json={
        "analysis_id": str(la.id),
        "scope": "user"
    })
    assert r.status_code == 200
    data = r.json()
    assert data["dry_run"] is False
    assert data["assignment"]["scope"] == "user"

