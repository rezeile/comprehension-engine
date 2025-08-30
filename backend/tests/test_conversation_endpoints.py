"""
Integration tests for conversation API endpoints.

Tests for the new DELETE endpoints and empty conversation prevention.
"""

import pytest
import json
from uuid import uuid4, UUID
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import Mock, MagicMock, patch

from main import app
from database.connection import Base, get_db
from database.models import User, Conversation, ConversationTurn
from auth.dependencies import get_current_user


# File-based SQLite database for testing to share schema across connections
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_endpoints.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    """Override database dependency for testing."""
    try:
        # Ensure schema exists for this engine/connection
        Base.metadata.create_all(bind=engine)
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database session for each test."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def sample_user(db_session):
    """Create a sample user for testing."""
    user = User(
        email="test@example.com",
        name="Test User",
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def other_user(db_session):
    """Create another user for testing ownership checks."""
    user = User(
        email="other@example.com",
        name="Other User",
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def sample_conversation(db_session, sample_user):
    """Create a sample conversation for testing."""
    conversation = Conversation(
        user_id=sample_user.id,
        title="Test Conversation",
        is_active=True
    )
    db_session.add(conversation)
    db_session.commit()
    db_session.refresh(conversation)
    return conversation


@pytest.fixture
def sample_turn(db_session, sample_conversation):
    """Create a sample conversation turn for testing."""
    turn = ConversationTurn(
        conversation_id=sample_conversation.id,
        turn_number=1,
        user_input="Hello",
        ai_response="Hi there!",
        response_time_ms=100
    )
    db_session.add(turn)
    db_session.commit()
    db_session.refresh(turn)
    return turn


@pytest.fixture
def client(db_session):
    """Create a test client with database override."""
    app.dependency_overrides[get_db] = override_get_db
    
    with TestClient(app) as test_client:
        yield test_client
    
    app.dependency_overrides.clear()


def override_get_current_user(user):
    """Create a function to override the current user dependency."""
    def _override():
        return user
    return _override


class TestConversationDeleteEndpoints:
    """Test cases for conversation deletion endpoints."""

    def test_delete_conversation_success(self, client, sample_conversation, sample_turn, sample_user, db_session):
        """Test successfully deleting a conversation."""
        app.dependency_overrides[get_current_user] = override_get_current_user(sample_user)
        
        response = client.delete(f"/api/conversations/{sample_conversation.id}")
        assert response.status_code == 204
        
        # Verify conversation is deleted
        conversation = db_session.query(Conversation).filter(
            Conversation.id == sample_conversation.id
        ).first()
        assert conversation is None
        
        # Verify turns are also deleted
        turns = db_session.query(ConversationTurn).filter(
            ConversationTurn.conversation_id == sample_conversation.id
        ).all()
        assert len(turns) == 0

    def test_delete_conversation_not_found(self, client, sample_user):
        """Test deleting a non-existent conversation."""
        app.dependency_overrides[get_current_user] = override_get_current_user(sample_user)
        
        fake_id = str(uuid4())
        response = client.delete(f"/api/conversations/{fake_id}")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_delete_conversation_wrong_owner(self, client, sample_conversation, other_user):
        """Test deleting a conversation owned by another user."""
        app.dependency_overrides[get_current_user] = override_get_current_user(other_user)
        
        response = client.delete(f"/api/conversations/{sample_conversation.id}")
        assert response.status_code == 403
        assert "forbidden" in response.json()["detail"].lower()

    def test_delete_conversation_turn_success(self, client, sample_conversation, sample_turn, sample_user, db_session):
        """Test successfully deleting a conversation turn."""
        app.dependency_overrides[get_current_user] = override_get_current_user(sample_user)
        
        # Add a second turn so the conversation isn't deleted
        turn2 = ConversationTurn(
            conversation_id=sample_conversation.id,
            turn_number=2,
            user_input="Second message",
            ai_response="Second response",
            response_time_ms=200
        )
        db_session.add(turn2)
        db_session.commit()
        
        response = client.delete(f"/api/conversations/{sample_conversation.id}/turns/{sample_turn.id}")
        assert response.status_code == 204
        
        # Verify turn is deleted
        turn = db_session.query(ConversationTurn).filter(
            ConversationTurn.id == sample_turn.id
        ).first()
        assert turn is None
        
        # Verify conversation still exists
        conversation = db_session.query(Conversation).filter(
            Conversation.id == sample_conversation.id
        ).first()
        assert conversation is not None

    def test_delete_conversation_turn_last_turn_deletes_conversation(self, client, sample_conversation, 
                                                                   sample_turn, sample_user, db_session):
        """Test deleting the last turn also deletes the conversation."""
        app.dependency_overrides[get_current_user] = override_get_current_user(sample_user)
        
        response = client.delete(f"/api/conversations/{sample_conversation.id}/turns/{sample_turn.id}")
        assert response.status_code == 204
        
        # Verify both turn and conversation are deleted
        turn = db_session.query(ConversationTurn).filter(
            ConversationTurn.id == sample_turn.id
        ).first()
        assert turn is None
        
        conversation = db_session.query(Conversation).filter(
            Conversation.id == sample_conversation.id
        ).first()
        assert conversation is None

    def test_delete_conversation_turn_not_found(self, client, sample_conversation, sample_user):
        """Test deleting a non-existent turn."""
        app.dependency_overrides[get_current_user] = override_get_current_user(sample_user)
        
        fake_turn_id = str(uuid4())
        response = client.delete(f"/api/conversations/{sample_conversation.id}/turns/{fake_turn_id}")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_delete_conversation_turn_conversation_not_found(self, client, sample_user):
        """Test deleting a turn from a non-existent conversation."""
        app.dependency_overrides[get_current_user] = override_get_current_user(sample_user)
        
        fake_conv_id = str(uuid4())
        fake_turn_id = str(uuid4())
        response = client.delete(f"/api/conversations/{fake_conv_id}/turns/{fake_turn_id}")
        assert response.status_code == 404


class TestEmptyConversationPrevention:
    """Test cases for preventing empty conversation creation."""

    @patch('main.client')  # Mock the Anthropic client
    def test_chat_creates_conversation_lazily(self, mock_anthropic_client, client, sample_user, db_session):
        """Test that chat endpoint creates conversation only when persisting turns."""
        app.dependency_overrides[get_current_user] = override_get_current_user(sample_user)
        
        # Mock Anthropic response
        mock_response = Mock()
        mock_response.content = [Mock(text="Hello! How can I help you?")]
        mock_anthropic_client.messages.create.return_value = mock_response
        
        # Count conversations before request
        initial_count = db_session.query(Conversation).count()
        
        response = client.post("/api/chat", json={
            "message": "Hello",
            "start_new": True
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert "conversation_id" in data
        
        # Verify conversation was created (lazy creation)
        final_count = db_session.query(Conversation).count()
        assert final_count == initial_count + 1
        
        # Verify turn was created
        conversation_id = data["conversation_id"]
        turns = db_session.query(ConversationTurn).filter(
            ConversationTurn.conversation_id == UUID(conversation_id)
        ).all()
        assert len(turns) == 1

    @patch('main.client')  # Mock the Anthropic client
    def test_chat_no_conversation_created_on_error(self, mock_anthropic_client, client, sample_user, db_session):
        """Test that no conversation is created if chat fails before response generation."""
        app.dependency_overrides[get_current_user] = override_get_current_user(sample_user)
        
        # Mock Anthropic to raise an exception
        mock_anthropic_client.messages.create.side_effect = Exception("API Error")
        
        initial_count = db_session.query(Conversation).count()
        
        response = client.post("/api/chat", json={
            "message": "Hello",
            "start_new": True
        })
        
        assert response.status_code == 500
        
        # Verify no conversation was created
        final_count = db_session.query(Conversation).count()
        assert final_count == initial_count

    @patch('main.client')  # Mock the Anthropic client
    @patch('main.ELEVENLABS_AVAILABLE', True)
    @patch('main.eleven_stream_tts')
    def test_voice_chat_creates_conversation_lazily(self, mock_tts, mock_anthropic_client, 
                                                   client, sample_user, db_session):
        """Test that voice chat endpoint creates conversation only when persisting turns."""
        app.dependency_overrides[get_current_user] = override_get_current_user(sample_user)
        
        # Mock Anthropic streaming response
        mock_stream = MagicMock()
        mock_events = [
            Mock(type="content_block_delta", delta=Mock(text="Hello! ")),
            Mock(type="content_block_delta", delta=Mock(text="How can I help?")),
            Mock(type="message_stop")
        ]
        mock_stream.__enter__.return_value.__iter__.return_value = mock_events
        mock_anthropic_client.messages.stream.return_value = mock_stream
        
        # Mock TTS
        mock_tts.return_value = iter([b"audio_chunk_1", b"audio_chunk_2"])
        
        initial_count = db_session.query(Conversation).count()
        
        response = client.post("/api/voice_chat", json={
            "message": "Hello",
            "start_new": True
        })
        
        assert response.status_code == 200
        
        # Verify conversation was created (lazy creation)
        final_count = db_session.query(Conversation).count()
        assert final_count == initial_count + 1
        
        # Verify turn was created
        turns = db_session.query(ConversationTurn).all()
        assert len(turns) == 1
        assert turns[0].ai_response == "Hello! How can I help?"

    @patch('main.client')  # Mock the Anthropic client  
    @patch('main.ELEVENLABS_AVAILABLE', True)
    def test_voice_chat_no_conversation_on_empty_response(self, mock_anthropic_client, 
                                                         client, sample_user, db_session):
        """Test that no conversation is created if voice chat produces empty response."""
        app.dependency_overrides[get_current_user] = override_get_current_user(sample_user)
        
        # Mock Anthropic streaming response with empty content
        mock_stream = MagicMock()
        mock_events = [
            Mock(type="message_stop")  # No content_block_delta events
        ]
        mock_stream.__enter__.return_value.__iter__.return_value = mock_events
        mock_anthropic_client.messages.stream.return_value = mock_stream
        
        initial_count = db_session.query(Conversation).count()
        
        response = client.post("/api/voice_chat", json={
            "message": "Hello",
            "start_new": True
        })
        
        assert response.status_code == 200
        
        # Verify no conversation was created due to empty response
        final_count = db_session.query(Conversation).count()
        assert final_count == initial_count

    def test_chat_reuses_existing_conversation(self, client, sample_conversation, sample_user, db_session):
        """Test that chat endpoint reuses existing active conversation when not creating new."""
        app.dependency_overrides[get_current_user] = override_get_current_user(sample_user)
        
        with patch('main.client') as mock_anthropic_client:
            # Mock Anthropic response
            mock_response = Mock()
            mock_response.content = [Mock(text="Sure, I can help!")]
            mock_anthropic_client.messages.create.return_value = mock_response
            
            initial_count = db_session.query(Conversation).count()
            
            response = client.post("/api/chat", json={
                "message": "Can you help me?",
                # Not specifying start_new or conversation_id should reuse existing
            })
            
            assert response.status_code == 200
            data = response.json()
            
            # Should reuse existing conversation
            assert data["conversation_id"] == str(sample_conversation.id)
            
            # No new conversation should be created
            final_count = db_session.query(Conversation).count()
            assert final_count == initial_count
