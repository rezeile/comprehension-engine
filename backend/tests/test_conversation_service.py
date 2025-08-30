"""
Unit tests for the conversation service.

Tests for conversation operations including creation, deletion,
and lazy initialization to prevent empty conversations.
"""

import pytest
from uuid import uuid4
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi import HTTPException

from database.connection import Base
from database.models import User, Conversation, ConversationTurn
from services.conversation_service import ConversationService


# In-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture
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
def conversation_service(db_session):
    """Create a conversation service instance."""
    return ConversationService(db_session)


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


class TestConversationService:
    """Test cases for ConversationService."""

    def test_get_conversation_by_id_success(self, conversation_service, sample_conversation, sample_user):
        """Test successfully getting a conversation by ID."""
        result = conversation_service.get_conversation_by_id(sample_conversation.id, sample_user)
        assert result is not None
        assert result.id == sample_conversation.id
        assert result.user_id == sample_user.id

    def test_get_conversation_by_id_not_found(self, conversation_service, sample_user):
        """Test getting a non-existent conversation."""
        fake_id = uuid4()
        result = conversation_service.get_conversation_by_id(fake_id, sample_user)
        assert result is None

    def test_get_conversation_by_id_wrong_owner(self, conversation_service, sample_conversation, other_user):
        """Test accessing a conversation owned by another user."""
        with pytest.raises(HTTPException) as exc_info:
            conversation_service.get_conversation_by_id(sample_conversation.id, other_user)
        assert exc_info.value.status_code == 403
        assert "Forbidden" in str(exc_info.value.detail)

    def test_get_or_create_conversation_lazy_existing(self, conversation_service, sample_conversation, sample_user):
        """Test getting an existing conversation lazily."""
        result = conversation_service.get_or_create_conversation_lazy(
            sample_user, 
            conversation_id=sample_conversation.id
        )
        assert result is not None
        assert result.id == sample_conversation.id

    def test_get_or_create_conversation_lazy_latest_active(self, conversation_service, sample_conversation, sample_user):
        """Test getting the latest active conversation when no ID specified."""
        result = conversation_service.get_or_create_conversation_lazy(sample_user)
        assert result is not None
        assert result.id == sample_conversation.id

    def test_get_or_create_conversation_lazy_start_new(self, conversation_service, sample_user):
        """Test lazy creation for start_new=True returns None."""
        result = conversation_service.get_or_create_conversation_lazy(sample_user, start_new=True)
        assert result is None

    def test_get_or_create_conversation_lazy_no_existing(self, conversation_service, sample_user):
        """Test lazy creation when no existing conversations returns None."""
        result = conversation_service.get_or_create_conversation_lazy(sample_user)
        assert result is None

    def test_create_conversation_with_turn_new_conversation(self, conversation_service, sample_user, db_session):
        """Test creating a new conversation with the first turn."""
        result = conversation_service.create_conversation_with_turn(
            user=sample_user,
            user_input="Hello world",
            ai_response="Hello! How can I help you?",
            response_time_ms=150
        )
        
        assert result is not None
        assert result.user_id == sample_user.id
        assert result.title == "New Conversation"
        
        # Check that the turn was created
        turns = db_session.query(ConversationTurn).filter(
            ConversationTurn.conversation_id == result.id
        ).all()
        assert len(turns) == 1
        assert turns[0].turn_number == 1
        assert turns[0].user_input == "Hello world"
        assert turns[0].ai_response == "Hello! How can I help you?"

    def test_create_conversation_with_turn_existing_conversation(self, conversation_service, sample_conversation, 
                                                               sample_turn, sample_user, db_session):
        """Test adding a turn to an existing conversation."""
        result = conversation_service.create_conversation_with_turn(
            user=sample_user,
            user_input="Second message",
            ai_response="Second response",
            response_time_ms=200,
            conversation=sample_conversation
        )
        
        assert result.id == sample_conversation.id
        
        # Check that both turns exist
        turns = db_session.query(ConversationTurn).filter(
            ConversationTurn.conversation_id == result.id
        ).order_by(ConversationTurn.turn_number).all()
        assert len(turns) == 2
        assert turns[0].turn_number == 1
        assert turns[1].turn_number == 2
        assert turns[1].user_input == "Second message"

    def test_create_conversation_with_turn_with_attachments(self, conversation_service, sample_user, db_session):
        """Test creating a conversation with attachments."""
        attachments = [{"url": "http://example.com/image.jpg", "alt": "test image"}]
        
        result = conversation_service.create_conversation_with_turn(
            user=sample_user,
            user_input="Look at this image",
            ai_response="I can see the image",
            response_time_ms=300,
            attachments=attachments
        )
        
        turns = db_session.query(ConversationTurn).filter(
            ConversationTurn.conversation_id == result.id
        ).all()
        assert len(turns) == 1
        assert turns[0].attachments == attachments

    def test_delete_conversation_success(self, conversation_service, sample_conversation, sample_turn, 
                                       sample_user, db_session):
        """Test successfully deleting a conversation."""
        conversation_service.delete_conversation(sample_conversation.id, sample_user)
        
        # Verify conversation is deleted
        result = db_session.query(Conversation).filter(
            Conversation.id == sample_conversation.id
        ).first()
        assert result is None
        
        # Verify turns are also deleted (cascade)
        turns = db_session.query(ConversationTurn).filter(
            ConversationTurn.conversation_id == sample_conversation.id
        ).all()
        assert len(turns) == 0

    def test_delete_conversation_not_found(self, conversation_service, sample_user):
        """Test deleting a non-existent conversation."""
        fake_id = uuid4()
        with pytest.raises(HTTPException) as exc_info:
            conversation_service.delete_conversation(fake_id, sample_user)
        assert exc_info.value.status_code == 404

    def test_delete_conversation_wrong_owner(self, conversation_service, sample_conversation, other_user):
        """Test deleting a conversation owned by another user."""
        with pytest.raises(HTTPException) as exc_info:
            conversation_service.delete_conversation(sample_conversation.id, other_user)
        assert exc_info.value.status_code == 403

    def test_delete_conversation_turn_success(self, conversation_service, sample_conversation, sample_turn, 
                                            sample_user, db_session):
        """Test successfully deleting a conversation turn."""
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
        
        conversation_service.delete_conversation_turn(
            sample_conversation.id, sample_turn.id, sample_user
        )
        
        # Verify turn is deleted
        result = db_session.query(ConversationTurn).filter(
            ConversationTurn.id == sample_turn.id
        ).first()
        assert result is None
        
        # Verify conversation still exists
        conversation = db_session.query(Conversation).filter(
            Conversation.id == sample_conversation.id
        ).first()
        assert conversation is not None

    def test_delete_conversation_turn_last_turn_deletes_conversation(self, conversation_service, 
                                                                   sample_conversation, sample_turn, 
                                                                   sample_user, db_session):
        """Test deleting the last turn also deletes the conversation."""
        conversation_service.delete_conversation_turn(
            sample_conversation.id, sample_turn.id, sample_user
        )
        
        # Verify both turn and conversation are deleted
        turn_result = db_session.query(ConversationTurn).filter(
            ConversationTurn.id == sample_turn.id
        ).first()
        assert turn_result is None
        
        conversation_result = db_session.query(Conversation).filter(
            Conversation.id == sample_conversation.id
        ).first()
        assert conversation_result is None

    def test_delete_conversation_turn_not_found(self, conversation_service, sample_conversation, sample_user):
        """Test deleting a non-existent turn."""
        fake_id = uuid4()
        with pytest.raises(HTTPException) as exc_info:
            conversation_service.delete_conversation_turn(
                sample_conversation.id, fake_id, sample_user
            )
        assert exc_info.value.status_code == 404

    def test_delete_conversation_turn_conversation_not_found(self, conversation_service, sample_user):
        """Test deleting a turn from a non-existent conversation."""
        fake_conv_id = uuid4()
        fake_turn_id = uuid4()
        with pytest.raises(HTTPException) as exc_info:
            conversation_service.delete_conversation_turn(fake_conv_id, fake_turn_id, sample_user)
        assert exc_info.value.status_code == 404

    def test_auto_generate_title_from_user_input(self, conversation_service, sample_user, db_session):
        """Test auto-generating title from user input."""
        conversation = Conversation(
            user_id=sample_user.id,
            title="New Conversation",
            is_active=True
        )
        db_session.add(conversation)
        db_session.commit()
        
        conversation_service.auto_generate_title(
            conversation, 
            "How to learn Python programming",
            "I can help you learn Python!"
        )
        
        db_session.refresh(conversation)
        assert conversation.title == "Learn Python Programming"

    def test_auto_generate_title_from_ai_response(self, conversation_service, sample_user, db_session):
        """Test auto-generating title from AI response when user input isn't suitable."""
        conversation = Conversation(
            user_id=sample_user.id,
            title="New Conversation",
            is_active=True
        )
        db_session.add(conversation)
        db_session.commit()
        
        conversation_service.auto_generate_title(
            conversation,
            "help",
            "Let's discuss machine learning algorithms and their applications"
        )
        
        db_session.refresh(conversation)
        assert conversation.title == "Discuss Machine Learning"

    def test_auto_generate_title_no_change_if_has_title(self, conversation_service, sample_user, db_session):
        """Test that auto-generation doesn't override existing meaningful titles."""
        conversation = Conversation(
            user_id=sample_user.id,
            title="Important Discussion",
            is_active=True
        )
        db_session.add(conversation)
        db_session.commit()
        
        conversation_service.auto_generate_title(
            conversation,
            "How to learn Python",
            "Let me help you"
        )
        
        db_session.refresh(conversation)
        assert conversation.title == "Important Discussion"

    def test_auto_generate_title_filters_stopwords(self, conversation_service, sample_user, db_session):
        """Test that auto-generation filters out stopwords."""
        conversation = Conversation(
            user_id=sample_user.id,
            title="New Conversation",
            is_active=True
        )
        db_session.add(conversation)
        db_session.commit()
        
        conversation_service.auto_generate_title(
            conversation,
            "What is the best way to learn about artificial intelligence",
            "I recommend starting with basics"
        )
        
        db_session.refresh(conversation)
        # Should filter out "what", "is", "the", "way", "to", "about"
        assert conversation.title == "Best Learn Artificial"
