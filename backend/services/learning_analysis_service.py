"""
Learning analysis service: reconstruct transcripts, call LLM, and persist analyses.

Phase 1 keeps LLM call plumbing minimal; a higher-level schema/validation will be added
when implementing the analysis endpoint.
"""

from __future__ import annotations

from typing import List, Dict, Any, Optional
from uuid import UUID
from dataclasses import dataclass
from sqlalchemy.orm import Session

from database.models import ConversationTurn, LearningAnalysis


@dataclass
class TranscriptTurn:
    turn_number: int
    role: str  # "user" | "assistant"
    text: str
    timestamp: Optional[str]


class LearningAnalysisService:
    def __init__(self, db: Session) -> None:
        self.db = db

    # -----------------
    # Transcript reconstruction
    # -----------------
    def get_voice_transcript(self, conversation_id: UUID) -> List[Dict[str, Any]]:
        """
        Build a transcript array of dicts for turns where voice was used.
        [{turn_number, role, text, timestamp}]
        """
        rows: List[ConversationTurn] = (
            self.db.query(ConversationTurn)
            .filter(ConversationTurn.conversation_id == conversation_id)
            .order_by(ConversationTurn.turn_number.asc())
            .all()
        )

        transcript: List[Dict[str, Any]] = []
        for r in rows:
            # Include only turns with voice_used set
            if not r.voice_used:
                continue
            transcript.append(
                {
                    "turn_number": int(r.turn_number),
                    "role": "user",
                    "text": r.user_input or "",
                    "timestamp": r.timestamp.isoformat() if getattr(r, "timestamp", None) else None,
                }
            )
            transcript.append(
                {
                    "turn_number": int(r.turn_number),
                    "role": "assistant",
                    "text": r.ai_response or "",
                    "timestamp": r.timestamp.isoformat() if getattr(r, "timestamp", None) else None,
                }
            )

        return transcript

    # -----------------
    # LLM call wrapper (placeholder)
    # -----------------
    def analyze_transcript(self, transcript: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Placeholder for LLM analysis. For now, return a minimal structured stub.
        A strict schema/validation will be added in the endpoint implementation.
        """
        # Simple heuristic stub
        return {
            "learning_style_patterns": ["compact_chunks"],
            "effective_moments": [],
            "preferred_explanations": ["analogy"],
            "connections": [],
            "summary": "stub analysis",
        }

    # -----------------
    # Persistence
    # -----------------
    def persist_analysis(
        self,
        *,
        user_id: UUID,
        conversation_id: UUID,
        transcript: List[Dict[str, Any]],
        features: Dict[str, Any],
        highlights: Optional[List[Dict[str, Any]]] = None,
        connections: Optional[List[Dict[str, Any]]] = None,
        prompt_suggestions: Optional[Dict[str, Any]] = None,
    ) -> LearningAnalysis:
        row = LearningAnalysis(
            user_id=user_id,
            conversation_id=conversation_id,
            transcript=transcript,
            features=features,
            highlights=highlights,
            connections=connections,
            prompt_suggestions=prompt_suggestions,
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return row


