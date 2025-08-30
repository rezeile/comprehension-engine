"""
Conversation service for managing conversations and turns.

This module provides business logic for conversation operations including
creation, deletion, and lazy initialization to prevent empty conversations.
"""

from typing import Optional, List
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from fastapi import HTTPException

from database.models import User, Conversation, ConversationTurn


class ConversationService:
    """Service class for conversation operations."""
    
    def __init__(self, db: Session):
        self.db = db

    def get_conversation_by_id(self, conversation_id: UUID, user: User) -> Optional[Conversation]:
        """
        Get a conversation by ID, verifying ownership.
        
        Args:
            conversation_id: The conversation ID
            user: The current user
            
        Returns:
            Conversation if found and owned by user, None otherwise
        """
        conversation = self.db.query(Conversation).filter(
            Conversation.id == conversation_id
        ).first()
        
        if not conversation:
            return None
            
        if conversation.user_id != user.id:
            raise HTTPException(status_code=403, detail="Forbidden: conversation does not belong to user")
            
        return conversation

    def get_or_create_conversation_lazy(self, user: User, conversation_id: Optional[UUID] = None, 
                                      start_new: bool = False) -> Optional[Conversation]:
        """
        Get an existing conversation or prepare for lazy creation.
        
        This method implements lazy conversation creation - it only returns
        an existing conversation or None. The actual creation happens when
        the first turn is persisted.
        
        Args:
            user: The current user
            conversation_id: Optional existing conversation ID
            start_new: Whether to start a new conversation
            
        Returns:
            Existing conversation or None (for lazy creation)
        """
        if conversation_id:
            return self.get_conversation_by_id(conversation_id, user)
        elif not start_new:
            # Try to find latest active conversation for potential reuse
            return self.db.query(Conversation).filter(
                Conversation.user_id == user.id,
                Conversation.is_active == True
            ).order_by(Conversation.created_at.desc()).first()
        
        # For start_new=True or no existing conversation, return None for lazy creation
        return None

    def create_conversation_with_turn(self, user: User, user_input: str, ai_response: str,
                                    response_time_ms: int, voice_used: Optional[str] = None,
                                    attachments: Optional[List] = None,
                                    conversation: Optional[Conversation] = None) -> Conversation:
        """
        Create a conversation and first turn in a single transaction.
        
        This method implements lazy conversation creation by creating both
        the conversation and the first turn together.
        
        Args:
            user: The current user
            user_input: User's input text
            ai_response: AI's response text
            response_time_ms: Response time in milliseconds
            voice_used: Optional voice ID used
            attachments: Optional list of attachments
            conversation: Optional existing conversation to add turn to
            
        Returns:
            The conversation (newly created or existing)
        """
        # Create conversation if none provided (lazy creation)
        if conversation is None:
            conversation = Conversation(user_id=user.id, title="New Conversation")
            self.db.add(conversation)
            self.db.flush()  # Get the ID but don't commit yet

        # Determine next turn number
        last_turn = self.db.query(ConversationTurn).filter(
            ConversationTurn.conversation_id == conversation.id
        ).order_by(ConversationTurn.turn_number.desc()).first()
        
        next_turn_number = (last_turn.turn_number + 1) if last_turn else 1

        # Create the turn
        turn = ConversationTurn(
            conversation_id=conversation.id,
            turn_number=next_turn_number,
            user_input=user_input,
            ai_response=ai_response,
            response_time_ms=response_time_ms,
            voice_used=voice_used,
            attachments=attachments if attachments else None,
        )
        self.db.add(turn)
        self.db.commit()  # Commit both conversation and turn together
        
        return conversation

    def get_voice_transcript(self, conversation_id: UUID) -> List[dict]:
        """
        Reconstruct a transcript list for a conversation including only turns where voice was used.
        Returns a list of dicts: {turn_number, role, text, timestamp} repeating user/assistant per turn.
        """
        rows = (
            self.db.query(ConversationTurn)
            .filter(ConversationTurn.conversation_id == conversation_id)
            .order_by(ConversationTurn.turn_number.asc())
            .all()
        )
        transcript: List[dict] = []
        for r in rows:
            if not r.voice_used:
                continue
            transcript.append({
                "turn_number": int(r.turn_number),
                "role": "user",
                "text": r.user_input or "",
                "timestamp": r.timestamp.isoformat() if getattr(r, "timestamp", None) else None,
            })
            transcript.append({
                "turn_number": int(r.turn_number),
                "role": "assistant",
                "text": r.ai_response or "",
                "timestamp": r.timestamp.isoformat() if getattr(r, "timestamp", None) else None,
            })
        return transcript

    def delete_conversation(self, conversation_id: UUID, user: User) -> None:
        """
        Delete a conversation and all its turns.
        
        Args:
            conversation_id: The conversation ID to delete
            user: The current user
            
        Raises:
            HTTPException: If conversation not found or not owned by user
        """
        conversation = self.get_conversation_by_id(conversation_id, user)
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        self.db.delete(conversation)
        self.db.commit()

    def delete_conversation_turn(self, conversation_id: UUID, turn_id: UUID, user: User) -> None:
        """
        Delete a specific conversation turn.
        
        If this is the last turn in the conversation, the conversation
        is also deleted for cleanliness.
        
        Args:
            conversation_id: The conversation ID
            turn_id: The turn ID to delete
            user: The current user
            
        Raises:
            HTTPException: If conversation or turn not found or not owned by user
        """
        # Verify conversation exists and belongs to user
        conversation = self.get_conversation_by_id(conversation_id, user)
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        # Verify turn exists and belongs to the conversation
        turn = self.db.query(ConversationTurn).filter(
            ConversationTurn.id == turn_id,
            ConversationTurn.conversation_id == conversation_id
        ).first()
        
        if not turn:
            raise HTTPException(status_code=404, detail="Turn not found")
        
        # Delete the turn
        self.db.delete(turn)
        
        # Update conversation's updated_at timestamp
        conversation.updated_at = func.now()
        self.db.add(conversation)
        
        # Check if this was the last turn in the conversation
        remaining_turns = self.db.query(ConversationTurn).filter(
            ConversationTurn.conversation_id == conversation_id,
            ConversationTurn.id != turn_id
        ).count()
        
        if remaining_turns == 0:
            # Delete the conversation if no turns remain
            self.db.delete(conversation)
        
        self.db.commit()

    def auto_generate_title(self, conversation: Conversation, user_input: str, ai_response: str) -> None:
        """
        Auto-generate a title for a conversation based on the first turn.
        
        Args:
            conversation: The conversation to title
            user_input: User's input text
            ai_response: AI's response text
        """
        if conversation.title and conversation.title.strip() and conversation.title.strip().lower() != "new conversation":
            return  # Already has a meaningful title
        
        def heuristic_title(text: str) -> Optional[str]:
            if not text:
                return None
            
            # Keep only letters/numbers/spaces
            import re
            cleaned = re.sub(r"[^A-Za-z0-9\s]", "", text)
            
            # Lowercase and split
            tokens = cleaned.lower().split()
            if not tokens:
                return None
            
            stopwords = {
                "the", "a", "an", "and", "or", "but", "if", "then", "else", "when", "at", "by", "for", 
                "with", "about", "against", "between", "into", "through", "during", "before", "after", 
                "above", "below", "to", "from", "up", "down", "in", "out", "on", "off", "over", "under", "way",
                "again", "further", "than", "once", "here", "there", "why", "how", "what", "which", 
                "who", "whom", "is", "are", "was", "were", "be", "been", "being", "do", "does", "did", 
                "doing", "have", "has", "had", "having", "of", "it", "this", "that", "these", "those", 
                "i", "you", "he", "she", "they", "we", "me", "him", "her", "them", "my", "your", "his", 
                "their", "our", "yours", "theirs", "ours", "as"
            }
            
            significant = [t for t in tokens if t not in stopwords]
            # Prefer AI response roots like 'let's discuss machine learning ...' -> 'Discuss Machine Learning'
            if significant and significant[0] in {"lets", "let", "discuss"}:
                # find first two non-filler tokens after the lead-in token(s)
                filtered = [
                    w for w in significant[1:]
                    if w not in {"and", "or", "the", "a", "an", "of", "discuss", "lets", "let"}
                ]
                if len(filtered) >= 2:
                    significant = ["discuss", filtered[0], filtered[1]]
            # Keep first 3 non-stopwords; if none, fallback to first 3 tokens
            selected = (significant or tokens)[:3]
            title = " ".join(selected).strip()
            
            if not title:
                return None
            
            # Title case words
            title = " ".join(w.capitalize() for w in title.split())
            # Require at least two words to be meaningful
            if len(title.split()) < 2:
                return None
            return title

        candidate = heuristic_title(user_input) or heuristic_title(ai_response)
        if candidate and len(candidate.split()) <= 3:
            conversation.title = candidate
            self.db.add(conversation)
            self.db.commit()
