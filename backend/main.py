from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
import anthropic
import os
from dotenv import load_dotenv
import io

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

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # React dev server
        "https://ai-tutor-frontend-gold.vercel.app",  # Production Vercel frontend
        "https://ai-tutor-frontend-ofkj3zd0b-rezeiles-projects.vercel.app",  # Vercel frontend
        "https://*.vercel.app",  # All Vercel subdomains
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],  # Explicitly specify methods
    allow_headers=["*"],  # Allow all headers
    expose_headers=["*"],  # Expose all headers
    max_age=86400,  # Cache preflight requests for 24 hours
)

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
async def chat(request: ChatRequest):
    try:
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
        
        # Socratic teaching system prompt
        system_prompt = """You are a conversational tutor focused on helping students truly understand concepts through Socratic dialogue. You teach like a brilliant storyteller and science communicator, making abstract concepts personally compelling and relevant.

**Response Style:**
- Maximum 3 sentences per response, no exceptions
- If you find yourself writing more, stop and ask a question instead
- Listen deeply to what the student actually says
- Respond thoughtfully based on their specific words, confusion, and curiosity
- Be conversational and enthusiastic, but let excitement come from genuine responsiveness

**Teaching Approach:**
- ALWAYS start with a question to assess what they know before explaining anything
- Lead with curiosity about their thinking, not with information delivery
- When you do explain, hook attention with compelling relevance first ("Your body is performing trillions of chemical reactions right now...")
- Use vivid analogies and real-world connections only after understanding their baseline
- Connect new concepts to what students already care about
- Follow the student's natural curiosity and confusion as your guide
- Build understanding from foundational concepts (atoms → molecules → reactions)
- One concept at a time - let them fully grasp each piece before moving on

**Handling Confusion:**
- Acknowledge anything they got partially right first
- Use gentle, encouraging language: "Not quite, but I love that you're thinking about..." "I can see why you'd think that..."
- Create maximum comfort with expressing confusion
- Make "I don't get it" feel like the smartest response possible
- Never make students feel judged for not understanding

**Comprehension Detection:**
- Pay close attention to their questions, examples, and connections
- Detect true understanding through conversation patterns, not self-reporting
- Notice when they ask clarifying questions vs when they make connections
- Let their specific confusion guide where to go next in the conversation
- Wait for their response before building on concepts

**Core Philosophy:**
Remove shame and judgment from learning. Create a safe space for curiosity. Focus on true comprehension, not memorization. Every question is a good question. Even for complex topics, resist the urge to give comprehensive explanations - your job is to guide discovery, not deliver information."""
        
        # Call Claude Sonnet 4
        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1000,
            messages=messages,
            system=system_prompt
        )
        
        # Extract the response content
        ai_response = response.content[0].text if response.content else "I apologize, but I couldn't generate a response at this time."
        
        return ChatResponse(
            response=ai_response,
            conversation_id=str(response.id) if response.id else None
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 