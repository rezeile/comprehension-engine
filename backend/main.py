from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from starlette.middleware.sessions import SessionMiddleware
from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID
import anthropic
import os
from dotenv import load_dotenv
import io
from sqlalchemy.orm import Session
from time import perf_counter
import re

# Import our new prompt management system
from prompts import prompt_manager
from config import prompt_settings

# Import database components
from database import get_db, User, Conversation, ConversationTurn
from database.connection import init_db

# Import API routes
from api.auth_routes import router as auth_router
from auth.dependencies import get_current_user

# ElevenLabs imports
try:
    from elevenlabs import generate, set_api_key
    from elevenlabs import Voice
    ELEVENLABS_AVAILABLE = True
except ImportError:
    ELEVENLABS_AVAILABLE = False
    print("Warning: ElevenLabs not available. Install with: pip install elevenlabs")

# Load environment variables
load_dotenv()

app = FastAPI(title="Comprehension Engine API", version="1.0.0")

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    try:
        init_db()
        print("Database initialized successfully")
    except Exception as e:
        print(f"Database initialization failed: {e}")
        # Don't fail startup, allow API to run even if DB is down

# Session middleware for OAuth (must be added before other middleware)
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production")
app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY)

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # React dev server
        "http://127.0.0.1:3000",  # Alternative localhost
        "https://demo.brightspring.ai",  # Production frontend
        "https://api.brightspring.ai",  # Production backend (for OAuth redirects)
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],  # Include PATCH for updates
    allow_headers=["*"],  # Allow all headers
    expose_headers=["*"],  # Expose all headers
    max_age=86400,  # Cache preflight requests for 24 hours
)

# Include authentication routes
app.include_router(auth_router)

# Initialize Anthropic client
api_key = os.getenv("ANTHROPIC_API_KEY")
if not api_key or api_key == "your-api-key-here":
    raise ValueError("ANTHROPIC_API_KEY environment variable is not set or is invalid")

client = anthropic.Anthropic(api_key=api_key)

# Initialize ElevenLabs if available
if ELEVENLABS_AVAILABLE:
    elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")
    if elevenlabs_api_key and elevenlabs_api_key != "your-elevenlabs-api-key-here":
        set_api_key(elevenlabs_api_key)
        print("ElevenLabs API configured successfully")
    else:
        print("Warning: ELEVENLABS_API_KEY not set. TTS will use fallback.")

class ChatMessage(BaseModel):
    content: str
    role: str = "user"

class ChatRequest(BaseModel):
    message: str
    conversation_history: Optional[List[dict]] = []
    conversation_id: Optional[UUID] = None
    start_new: Optional[bool] = False

class ChatResponse(BaseModel):
    response: str
    conversation_id: Optional[str] = None


# Conversation persistence schemas
class ConversationSummary(BaseModel):
    id: UUID
    title: Optional[str] = None
    topic: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    is_active: bool
    last_turn_at: Optional[str] = None
    turn_count: int

    class Config:
        from_attributes = True


class ConversationTurnResponse(BaseModel):
    id: UUID
    turn_number: int
    user_input: str
    ai_response: str
    timestamp: Optional[str] = None
    comprehension_score: Optional[int] = None
    comprehension_notes: Optional[str] = None

    class Config:
        from_attributes = True


class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    is_active: Optional[bool] = None
    topic: Optional[str] = None

    # Keep config minimal to match existing pydantic usage style in this file

# New TTS models
class TTSRequest(BaseModel):
    text: str
    voice_id: str = "21m00Tcm4TlvDq8ikWAM"  # Default to Rachel voice

class VoiceInfo(BaseModel):
    id: str
    name: str
    description: str
    category: str

# Pre-defined voices for the app
AVAILABLE_VOICES = [
    VoiceInfo(
        id="21m00Tcm4TlvDq8ikWAM",
        name="Rachel",
        description="Clear, friendly, educational voice",
        category="Educational"
    ),
    VoiceInfo(
        id="AZnzlk1XvdvUeBnXmlld",
        name="Domi",
        description="Warm, encouraging, patient voice",
        category="Friendly"
    ),
    VoiceInfo(
        id="EXAVITQu4vr4xnSDxMaL",
        name="Bella",
        description="Energetic, engaging, youthful voice",
        category="Enthusiastic"
    ),
    VoiceInfo(
        id="ErXwobaYiN019PkySvjV",
        name="Antoni",
        description="Professional, authoritative, trustworthy voice",
        category="Professional"
    )
]

@app.get("/")
async def root():
    return {"message": "Comprehension Engine API is running!"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "comprehension-engine"}

@app.get("/health/db")
async def database_health_check(db: Session = Depends(get_db)):
    """Check database connectivity and return basic stats"""
    try:
        # Simple query to test connection
        user_count = db.query(User).count()
        conversation_count = db.query(Conversation).count()
        turn_count = db.query(ConversationTurn).count()
        
        return {
            "status": "healthy",
            "database": "connected",
            "stats": {
                "users": user_count,
                "conversations": conversation_count,
                "conversation_turns": turn_count
            }
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database connection failed: {str(e)}")

@app.get("/api/voices")
async def get_available_voices():
    """Get list of available ElevenLabs voices"""
    return {"voices": AVAILABLE_VOICES}

@app.post("/api/tts")
async def text_to_speech(request: TTSRequest):
    """Convert text to speech using ElevenLabs"""
    if not ELEVENLABS_AVAILABLE:
        raise HTTPException(status_code=503, detail="ElevenLabs TTS not available")
    
    try:
        # Validate voice ID
        valid_voice_ids = [voice.id for voice in AVAILABLE_VOICES]
        if request.voice_id not in valid_voice_ids:
            raise HTTPException(status_code=400, detail="Invalid voice ID")
        
        # Generate speech with ElevenLabs
        audio = generate(
            text=request.text,
            voice=request.voice_id,
            model="eleven_multilingual_v2"
        )
        
        # Return audio as streaming response
        return StreamingResponse(
            io.BytesIO(audio),
            media_type="audio/mpeg",
            headers={"Content-Disposition": "attachment; filename=speech.mp3"}
        )
        
    except Exception as e:
        print(f"ElevenLabs TTS error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        start_time = perf_counter()
        # Prepare conversation history for Claude
        messages = []
        
        # Add conversation history if provided
        if request.conversation_history:
            for msg in request.conversation_history:
                if msg.get("role") == "user":
                    messages.append({"role": "user", "content": msg["content"]})
                elif msg.get("role") == "assistant":
                    messages.append({"role": "assistant", "content": msg["content"]})
        
        # Add current user message
        messages.append({"role": "user", "content": request.message})
        
        # Get system prompt from our prompt management system
        system_prompt = prompt_manager.get_active_prompt()
        
        # Call Claude Sonnet 4 with dynamic system prompt
        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1000,
            system=system_prompt,
            messages=messages
        )
        
        # Extract the response content
        ai_response = response.content[0].text if response.content else "I apologize, but I couldn't generate a response at this time."

        # Persist conversation/turn if authenticated
        conversation_id_str: Optional[str] = None
        try:
            if current_user:
                from database.models import Conversation, ConversationTurn

                conversation = None

                # Determine conversation handling based on request
                if request.start_new:
                    conversation = Conversation(user_id=current_user.id, title="New Conversation")
                    db.add(conversation)
                    db.commit()
                    db.refresh(conversation)
                elif request.conversation_id:
                    conversation = (
                        db.query(Conversation)
                        .filter(Conversation.id == request.conversation_id)
                        .first()
                    )
                    if not conversation:
                        raise HTTPException(status_code=404, detail="Conversation not found")
                    if conversation.user_id != current_user.id:
                        raise HTTPException(status_code=403, detail="Forbidden: conversation does not belong to user")
                else:
                    # Fallback to latest active conversation (simple strategy)
                    conversation = (
                        db.query(Conversation)
                        .filter(Conversation.user_id == current_user.id, Conversation.is_active == True)
                        .order_by(Conversation.created_at.desc())
                        .first()
                    )
                    if not conversation:
                        conversation = Conversation(user_id=current_user.id, title="New Conversation")
                        db.add(conversation)
                        db.commit()
                        db.refresh(conversation)

                # Determine next turn number
                last_turn = (
                    db.query(ConversationTurn)
                    .filter(ConversationTurn.conversation_id == conversation.id)
                    .order_by(ConversationTurn.turn_number.desc())
                    .first()
                )
                next_turn_number = (last_turn.turn_number + 1) if last_turn else 1

                elapsed_ms = int((perf_counter() - start_time) * 1000)

                turn = ConversationTurn(
                    conversation_id=conversation.id,
                    turn_number=next_turn_number,
                    user_input=request.message,
                    ai_response=ai_response,
                    response_time_ms=elapsed_ms,
                    voice_used=None,
                )
                db.add(turn)
                db.commit()
                db.refresh(turn)
                conversation_id_str = str(conversation.id)

                # Auto-title generation: after first turn if conversation has no title
                try:
                    if next_turn_number == 1 and (conversation.title is None or conversation.title.strip() == "" or conversation.title.strip().lower() == "new conversation"):
                        def heuristic_title(text: str) -> Optional[str]:
                            if not text:
                                return None
                            # Keep only letters/numbers/spaces
                            cleaned = re.sub(r"[^A-Za-z0-9\s]", "", text)
                            # Lowercase and split
                            tokens = cleaned.lower().split()
                            if not tokens:
                                return None
                            stopwords = {
                                "the","a","an","and","or","but","if","then","else","when","at","by","for","with","about","against","between","into","through","during","before","after","above","below","to","from","up","down","in","out","on","off","over","under","again","further","than","once","here","there","why","how","what","which","who","whom","is","are","was","were","be","been","being","do","does","did","doing","have","has","had","having","of","it","this","that","these","those","i","you","he","she","they","we","me","him","her","them","my","your","his","their","our","yours","theirs","ours","as"
                            }
                            # Keep first 3 non-stopwords; if none, fallback to first 3 tokens
                            significant = [t for t in tokens if t not in stopwords]
                            selected = (significant or tokens)[:3]
                            title = " ".join(selected).strip()
                            if not title:
                                return None
                            # Title case words
                            title = " ".join(w.capitalize() for w in title.split())
                            return title

                        candidate = heuristic_title(request.message) or heuristic_title(ai_response)
                        if candidate and len(candidate.split()) <= 3:
                            # Persist the title
                            conversation.title = candidate
                            db.add(conversation)
                            db.commit()
                except Exception as title_error:
                    # Do not fail chat on title issues
                    print(f"Auto-title generation failed: {title_error}")
        except HTTPException:
            raise
        except Exception as persist_error:
            # Do not fail the chat on persistence issues
            print(f"Warning: failed to persist conversation turn: {persist_error}")

        return ChatResponse(
            response=ai_response,
            conversation_id=conversation_id_str
        )
        
    except anthropic.APIError as e:
        print(f"Anthropic API error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Anthropic API error: {str(e)}")
    except Exception as e:
        print(f"Internal server error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.get("/api/conversations", response_model=List[ConversationSummary])
async def list_conversations(limit: int = 20, offset: int = 0, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        from database.models import Conversation, ConversationTurn

        conversations = (
            db.query(Conversation)
            .filter(Conversation.user_id == current_user.id)
            .order_by(Conversation.updated_at.desc(), Conversation.created_at.desc())
            .limit(limit)
            .offset(offset)
            .all()
        )

        # Compute last_turn_at and turn_count for each conversation
        summaries: List[ConversationSummary] = []
        for c in conversations:
            last_turn = (
                db.query(ConversationTurn)
                .filter(ConversationTurn.conversation_id == c.id)
                .order_by(ConversationTurn.timestamp.desc())
                .first()
            )
            turn_count = (
                db.query(ConversationTurn)
                .filter(ConversationTurn.conversation_id == c.id)
                .count()
            )
            summaries.append(ConversationSummary(
                id=c.id,
                title=c.title,
                topic=c.topic,
                created_at=c.created_at.isoformat() if c.created_at else None,
                updated_at=c.updated_at.isoformat() if c.updated_at else None,
                is_active=c.is_active,
                last_turn_at=last_turn.timestamp.isoformat() if last_turn and last_turn.timestamp else None,
                turn_count=turn_count
            ))
        return summaries
    except HTTPException:
        raise
    except Exception as e:
        print(f"Failed to list conversations: {e}")
        raise HTTPException(status_code=500, detail="Failed to list conversations")


@app.patch("/api/conversations/{conversation_id}", response_model=ConversationSummary)
async def update_conversation(conversation_id: UUID, payload: ConversationUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        from database.models import Conversation, ConversationTurn

        conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        if conversation.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Forbidden: conversation does not belong to user")

        updated = False
        if payload.title is not None:
            # Normalize: enforce <= 3 words and strip punctuation
            cleaned = re.sub(r"[^A-Za-z0-9\s]", "", payload.title or "").strip()
            words = cleaned.split()
            cleaned = " ".join(words[:3])
            conversation.title = cleaned if cleaned else None
            updated = True
        if payload.is_active is not None:
            conversation.is_active = bool(payload.is_active)
            updated = True
        if payload.topic is not None:
            conversation.topic = payload.topic.strip() if payload.topic else None
            updated = True

        if updated:
            db.add(conversation)
            db.commit()

        # Build summary
        last_turn = (
            db.query(ConversationTurn)
            .filter(ConversationTurn.conversation_id == conversation.id)
            .order_by(ConversationTurn.timestamp.desc())
            .first()
        )
        turn_count = (
            db.query(ConversationTurn)
            .filter(ConversationTurn.conversation_id == conversation.id)
            .count()
        )

        return ConversationSummary(
            id=conversation.id,
            title=conversation.title,
            topic=conversation.topic,
            created_at=conversation.created_at.isoformat() if conversation.created_at else None,
            updated_at=conversation.updated_at.isoformat() if conversation.updated_at else None,
            is_active=conversation.is_active,
            last_turn_at=last_turn.timestamp.isoformat() if last_turn and last_turn.timestamp else None,
            turn_count=turn_count
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Failed to update conversation: {e}")
        raise HTTPException(status_code=500, detail="Failed to update conversation")


@app.get("/api/conversations/{conversation_id}/turns", response_model=List[ConversationTurnResponse])
async def list_conversation_turns(conversation_id: UUID, limit: int = 50, offset: int = 0, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        from database.models import Conversation, ConversationTurn

        conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        if conversation.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Forbidden: conversation does not belong to user")

        turns = (
            db.query(ConversationTurn)
            .filter(ConversationTurn.conversation_id == conversation_id)
            .order_by(ConversationTurn.turn_number.asc())
            .limit(limit)
            .offset(offset)
            .all()
        )

        return [
            ConversationTurnResponse(
                id=t.id,
                turn_number=t.turn_number,
                user_input=t.user_input,
                ai_response=t.ai_response,
                timestamp=t.timestamp.isoformat() if t.timestamp else None,
                comprehension_score=t.comprehension_score,
                comprehension_notes=t.comprehension_notes
            )
            for t in turns
        ]
    except HTTPException:
        raise
    except Exception as e:
        print(f"Failed to list conversation turns: {e}")
        raise HTTPException(status_code=500, detail="Failed to list conversation turns")

@app.get("/api/cors-test")
async def cors_test():
    """Test endpoint to verify CORS is working"""
    return {"message": "CORS is working!", "timestamp": "2024-01-01T00:00:00Z"}

# Admin endpoints for prompt management
@app.get("/api/admin/prompts")
async def list_prompts():
    """List all available prompt variants"""
    try:
        variants_info = prompt_manager.get_all_variants_info()
        active_variant = prompt_manager.get_active_variant_name()
        config_summary = prompt_settings.get_config_summary()
        
        return {
            "variants": variants_info,
            "active_variant": active_variant,
            "config": config_summary,
            "status": "success"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list prompts: {str(e)}")

@app.get("/api/admin/prompts/{variant_name}")
async def get_prompt(variant_name: str):
    """Get specific prompt variant"""
    try:
        variant_info = prompt_manager.get_variant_info(variant_name)
        if variant_info:
            return {"variant": variant_info, "status": "success"}
        else:
            raise HTTPException(status_code=404, detail=f"Prompt variant '{variant_name}' not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get prompt: {str(e)}")

@app.post("/api/admin/prompts/{variant_name}/activate")
async def activate_prompt(variant_name: str):
    """Set prompt variant as active"""
    try:
        success = prompt_manager.set_active_variant(variant_name)
        if success:
            return {
                "message": f"Prompt variant '{variant_name}' activated successfully",
                "active_variant": variant_name,
                "status": "success"
            }
        else:
            raise HTTPException(status_code=400, detail=f"Failed to activate prompt variant '{variant_name}'")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to activate prompt: {str(e)}")

@app.get("/api/admin/prompts/status")
async def get_prompt_status():
    """Get current prompt system status"""
    try:
        return {
            "active_variant": prompt_manager.get_active_variant_name(),
            "total_variants": len(prompt_manager.list_variants()),
            "available_variants": prompt_manager.list_variants(),
            "config": prompt_settings.get_config_summary(),
            "status": "success"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get prompt status: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 