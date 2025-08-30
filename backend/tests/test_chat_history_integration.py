"""
Integration tests for the chat history deletion and empty conversation prevention features.

This module tests the complete workflow from chat creation to deletion,
ensuring all edge cases and error conditions are handled properly.
"""

import pytest
import json
from uuid import uuid4, UUID
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import Mock, patch, MagicMock

from main import app
from database.connection import Base, get_db
from database.models import User, Conversation, ConversationTurn
from auth.dependencies import get_current_user


# File-based SQLite database for testing to share schema across connections
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_chat_history.db"
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


class TestChatHistoryIntegration:
    """Integration tests for the complete chat history management workflow."""

    @patch('main.client')
    def test_complete_conversation_lifecycle(self, mock_anthropic_client, client, sample_user, db_session):
        """Test the complete lifecycle: create conversation, add turns, delete turn, delete conversation."""
        app.dependency_overrides[get_current_user] = override_get_current_user(sample_user)
        
        # Mock Anthropic responses
        mock_response1 = Mock()
        mock_response1.content = [Mock(text="Hello! I'm an AI assistant. How can I help you today?")]
        
        mock_response2 = Mock()
        mock_response2.content = [Mock(text="Python is a great programming language for beginners!")]
        
        mock_anthropic_client.messages.create.side_effect = [mock_response1, mock_response2]
        
        # Step 1: Create first conversation with chat
        initial_conv_count = db_session.query(Conversation).count()
        initial_turn_count = db_session.query(ConversationTurn).count()
        
        response1 = client.post("/api/chat", json={
            "message": "Hello, I need help with programming",
            "start_new": True
        })
        
        assert response1.status_code == 200
        data1 = response1.json()
        conversation_id = data1["conversation_id"]
        
        # Verify conversation and turn were created
        assert db_session.query(Conversation).count() == initial_conv_count + 1
        assert db_session.query(ConversationTurn).count() == initial_turn_count + 1
        
        # Step 2: Add a second turn to the same conversation
        response2 = client.post("/api/chat", json={
            "message": "What programming language should I learn first?",
            "conversation_id": conversation_id
        })
        
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["conversation_id"] == conversation_id
        
        # Verify only one more turn was added (no new conversation)
        assert db_session.query(Conversation).count() == initial_conv_count + 1
        assert db_session.query(ConversationTurn).count() == initial_turn_count + 2
        
        # Step 3: Get conversation turns
        response3 = client.get(f"/api/conversations/{conversation_id}/turns")
        assert response3.status_code == 200
        turns = response3.json()
        assert len(turns) == 2
        assert turns[0]["turn_number"] == 1
        assert turns[1]["turn_number"] == 2
        
        turn1_id = turns[0]["id"]
        turn2_id = turns[1]["id"]
        
        # Step 4: Delete the first turn (conversation should remain)
        response4 = client.delete(f"/api/conversations/{conversation_id}/turns/{turn1_id}")
        assert response4.status_code == 204
        
        # Verify turn was deleted but conversation remains
        response5 = client.get(f"/api/conversations/{conversation_id}/turns")
        assert response5.status_code == 200
        remaining_turns = response5.json()
        assert len(remaining_turns) == 1
        assert remaining_turns[0]["id"] == turn2_id
        
        # Verify conversation still exists
        response6 = client.get("/api/conversations")
        assert response6.status_code == 200
        conversations = response6.json()
        assert len(conversations) == 1
        assert conversations[0]["id"] == conversation_id
        
        # Step 5: Delete the last turn (should delete conversation too)
        response7 = client.delete(f"/api/conversations/{conversation_id}/turns/{turn2_id}")
        assert response7.status_code == 204
        
        # Verify both turn and conversation are gone
        response8 = client.get(f"/api/conversations/{conversation_id}/turns")
        assert response8.status_code == 404  # Conversation no longer exists
        
        response9 = client.get("/api/conversations")
        assert response9.status_code == 200
        final_conversations = response9.json()
        assert len(final_conversations) == 0

    @patch('main.client')
    def test_delete_conversation_directly(self, mock_anthropic_client, client, sample_user, db_session):
        """Test deleting an entire conversation directly."""
        app.dependency_overrides[get_current_user] = override_get_current_user(sample_user)
        
        # Mock Anthropic responses
        mock_responses = [
            Mock(content=[Mock(text="Response 1")]),
            Mock(content=[Mock(text="Response 2")]),
            Mock(content=[Mock(text="Response 3")])
        ]
        mock_anthropic_client.messages.create.side_effect = mock_responses
        
        # Create conversation with multiple turns
        response1 = client.post("/api/chat", json={"message": "Message 1", "start_new": True})
        conversation_id = response1.json()["conversation_id"]
        
        client.post("/api/chat", json={"message": "Message 2", "conversation_id": conversation_id})
        client.post("/api/chat", json={"message": "Message 3", "conversation_id": conversation_id})
        
        # Verify 3 turns exist
        response = client.get(f"/api/conversations/{conversation_id}/turns")
        turns = response.json()
        assert len(turns) == 3
        
        # Delete entire conversation
        delete_response = client.delete(f"/api/conversations/{conversation_id}")
        assert delete_response.status_code == 204
        
        # Verify conversation and all turns are gone
        response = client.get(f"/api/conversations/{conversation_id}/turns")
        assert response.status_code == 404
        
        # Verify no turns remain in database
        remaining_turns = db_session.query(ConversationTurn).filter(
            ConversationTurn.conversation_id == UUID(conversation_id)
        ).all()
        assert len(remaining_turns) == 0

    @patch('main.client')
    @patch('main.ELEVENLABS_AVAILABLE', True)
    @patch('main.eleven_stream_tts')
    def test_voice_chat_lazy_creation_and_deletion(self, mock_tts, mock_anthropic_client, 
                                                  client, sample_user, db_session):
        """Test voice chat lazy conversation creation and subsequent deletion."""
        app.dependency_overrides[get_current_user] = override_get_current_user(sample_user)
        
        # Mock streaming response
        mock_stream = MagicMock()
        mock_stream = MagicMock()
        mock_events = [
            Mock(type="content_block_delta", delta=Mock(text="Hello! I'm here to help you learn. ")),
            Mock(type="content_block_delta", delta=Mock(text="What would you like to know?")),
            Mock(type="message_stop")
        ]
        mock_stream.__enter__.return_value.__iter__.return_value = mock_events
        mock_anthropic_client.messages.stream.return_value = mock_stream
        
        # Mock TTS
        mock_tts.return_value = iter([b"audio_chunk"])
        
        initial_count = db_session.query(Conversation).count()
        
        # Make voice chat request
        response = client.post("/api/voice_chat", json={
            "message": "Teach me about science",
            "start_new": True
        })
        
        assert response.status_code == 200
        
        # Verify conversation was created lazily
        assert db_session.query(Conversation).count() == initial_count + 1
        
        # Get the created conversation
        conversation = db_session.query(Conversation).filter(
            Conversation.user_id == sample_user.id
        ).first()
        assert conversation is not None
        
        # Verify turn was created with expected content
        turns = db_session.query(ConversationTurn).filter(
            ConversationTurn.conversation_id == conversation.id
        ).all()
        assert len(turns) == 1
        assert turns[0].ai_response == "Hello! I'm here to help you learn. What would you like to know?"
        assert turns[0].voice_used is not None
        
        # Now delete the conversation
        delete_response = client.delete(f"/api/conversations/{conversation.id}")
        assert delete_response.status_code == 204
        
        # Verify everything is cleaned up
        assert db_session.query(Conversation).count() == initial_count
        assert db_session.query(ConversationTurn).count() == 0

    @patch('main.client')
    def test_error_scenarios_no_orphaned_conversations(self, mock_anthropic_client, client, sample_user, db_session):
        """Test that various error scenarios don't leave orphaned conversations."""
        app.dependency_overrides[get_current_user] = override_get_current_user(sample_user)
        
        initial_conv_count = db_session.query(Conversation).count()
        initial_turn_count = db_session.query(ConversationTurn).count()
        
        # Test 1: Anthropic API error before response
        mock_anthropic_client.messages.create.side_effect = Exception("API Error")
        
        response1 = client.post("/api/chat", json={
            "message": "This will fail",
            "start_new": True
        })
        assert response1.status_code == 500
        
        # Verify no conversation was created
        assert db_session.query(Conversation).count() == initial_conv_count
        assert db_session.query(ConversationTurn).count() == initial_turn_count
        
        # Test 2: Successful chat followed by failed deletion
        mock_anthropic_client.messages.create.side_effect = None
        mock_response = Mock()
        mock_response.content = [Mock(text="Success response")]
        mock_anthropic_client.messages.create.return_value = mock_response
        
        response2 = client.post("/api/chat", json={
            "message": "This will succeed",
            "start_new": True
        })
        assert response2.status_code == 200
        conversation_id = response2.json()["conversation_id"]
        
        # Verify conversation was created
        assert db_session.query(Conversation).count() == initial_conv_count + 1
        assert db_session.query(ConversationTurn).count() == initial_turn_count + 1
        
        # Test 3: Try to delete with wrong user (should fail)
        other_user = User(email="other@test.com", name="Other User", is_active=True)
        db_session.add(other_user)
        db_session.commit()
        
        app.dependency_overrides[get_current_user] = override_get_current_user(other_user)
        
        response3 = client.delete(f"/api/conversations/{conversation_id}")
        assert response3.status_code == 403
        
        # Verify conversation still exists (deletion failed as expected)
        app.dependency_overrides[get_current_user] = override_get_current_user(sample_user)
        response4 = client.get("/api/conversations")
        assert response4.status_code == 200
        assert len(response4.json()) == 1

    def test_multiple_users_isolation(self, client, db_session):
        """Test that conversation deletion respects user isolation."""
        # Create two users
        user1 = User(email="user1@test.com", name="User 1", is_active=True)
        user2 = User(email="user2@test.com", name="User 2", is_active=True)
        db_session.add_all([user1, user2])
        db_session.commit()
        
        # Create conversations for each user
        conv1 = Conversation(user_id=user1.id, title="User 1 Conv", is_active=True)
        conv2 = Conversation(user_id=user2.id, title="User 2 Conv", is_active=True)
        db_session.add_all([conv1, conv2])
        db_session.commit()
        
        # User 1 tries to delete User 2's conversation
        app.dependency_overrides[get_current_user] = override_get_current_user(user1)
        
        response = client.delete(f"/api/conversations/{conv2.id}")
        assert response.status_code == 403
        
        # Verify User 2's conversation still exists
        app.dependency_overrides[get_current_user] = override_get_current_user(user2)
        
        response = client.get("/api/conversations")
        assert response.status_code == 200
        conversations = response.json()
        assert len(conversations) == 1
        assert conversations[0]["id"] == str(conv2.id)
        
        # User 2 can delete their own conversation
        response = client.delete(f"/api/conversations/{conv2.id}")
        assert response.status_code == 204
        
        # Verify it's gone
        response = client.get("/api/conversations")
        assert response.status_code == 200
        assert len(response.json()) == 0

    @patch('main.client')
    def test_conversation_title_generation_and_preservation(self, mock_anthropic_client, client, sample_user, db_session):
        """Test that auto-generated titles are preserved during operations."""
        app.dependency_overrides[get_current_user] = override_get_current_user(sample_user)
        
        # Mock response for title generation
        mock_response = Mock()
        mock_response.content = [Mock(text="I can help you learn Python programming!")]
        mock_anthropic_client.messages.create.return_value = mock_response
        
        # Create conversation with meaningful first message
        response = client.post("/api/chat", json={
            "message": "How do I learn Python programming effectively",
            "start_new": True
        })
        
        conversation_id = response.json()["conversation_id"]
        
        # Check that title was auto-generated
        response = client.get("/api/conversations")
        conversations = response.json()
        assert len(conversations) == 1
        assert conversations[0]["title"] == "Learn Python Programming"
        
        # Add another turn
        mock_response2 = Mock()
        mock_response2.content = [Mock(text="Start with basic syntax and practice regularly.")]
        mock_anthropic_client.messages.create.return_value = mock_response2
        
        client.post("/api/chat", json={
            "message": "What should I start with?",
            "conversation_id": conversation_id
        })
        
        # Get turns
        turns_response = client.get(f"/api/conversations/{conversation_id}/turns")
        turns = turns_response.json()
        turn1_id = turns[0]["id"]
        
        # Delete first turn
        client.delete(f"/api/conversations/{conversation_id}/turns/{turn1_id}")
        
        # Verify title is preserved
        response = client.get("/api/conversations")
        conversations = response.json()
        assert len(conversations) == 1
        assert conversations[0]["title"] == "Learn Python Programming"
