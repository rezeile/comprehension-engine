"""
Unit tests for LearningAnalysisService covering transcript reconstruction and persistence.
"""

import pytest
from uuid import uuid4
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database.connection import Base
from database.models import User, Conversation, ConversationTurn, LearningAnalysis
from services.learning_analysis_service import LearningAnalysisService


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
    user = User(email="la@test.com", name="Learner", is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def sample_conversation(db_session, sample_user):
    conv = Conversation(user_id=sample_user.id, title="Voice Convo", is_active=True)
    db_session.add(conv)
    db_session.commit()
    db_session.refresh(conv)
    return conv


def test_transcript_reconstruction_voice_only(db_session, sample_conversation):
    # Turn 1 with voice
    t1 = ConversationTurn(
        conversation_id=sample_conversation.id,
        turn_number=1,
        user_input="Explain vectors",
        ai_response="Vectors are...",
        response_time_ms=120,
        voice_used="voice-1",
    )
    # Turn 2 without voice (should be excluded)
    t2 = ConversationTurn(
        conversation_id=sample_conversation.id,
        turn_number=2,
        user_input="Thanks",
        ai_response="You're welcome",
        response_time_ms=80,
        voice_used=None,
    )
    db_session.add_all([t1, t2])
    db_session.commit()

    svc = LearningAnalysisService(db_session)
    transcript = svc.get_voice_transcript(sample_conversation.id)
    assert isinstance(transcript, list)
    # Should contain two entries for turn 1: user then assistant
    assert len(transcript) == 2
    assert transcript[0]["role"] == "user"
    assert transcript[1]["role"] == "assistant"


def test_persist_analysis(db_session, sample_user, sample_conversation):
    svc = LearningAnalysisService(db_session)
    transcript = [
        {"turn_number": 1, "role": "user", "text": "Explain X", "timestamp": None},
        {"turn_number": 1, "role": "assistant", "text": "X is...", "timestamp": None},
    ]
    features = svc.analyze_transcript(transcript)
    row = svc.persist_analysis(
        user_id=sample_user.id,
        conversation_id=sample_conversation.id,
        transcript=transcript,
        features=features,
    )
    assert isinstance(row.id, type(sample_user.id))  # UUID type
    fetched = db_session.query(LearningAnalysis).filter(LearningAnalysis.id == row.id).first()
    assert fetched is not None
    assert fetched.user_id == sample_user.id

