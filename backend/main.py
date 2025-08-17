from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from starlette.middleware.sessions import SessionMiddleware
from pydantic import BaseModel
from typing import List, Optional
import anthropic
import os
from dotenv import load_dotenv
import io
from sqlalchemy.orm import Session
from time import perf_counter

# Import our new prompt management system
from prompts import prompt_manager
from config import prompt_settings

# Import database components
from database import get_db, User, Conversation, ConversationTurn
from database.connection import init_db

# Import API routes
from api.auth_routes import router as auth_router

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
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],  # Explicitly specify methods
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

class ChatResponse(BaseModel):
    response: str
    conversation_id: Optional[str] = None

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
async def chat(request: ChatRequest, db: Session = Depends(get_db), current_user: Optional[User] = Depends(lambda: None)):
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
                # Find or create an active conversation for this user (simple strategy)
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
                conversation_id_str = str(conversation.id)
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