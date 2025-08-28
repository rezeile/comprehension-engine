from fastapi import FastAPI, HTTPException, Depends
from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from starlette.middleware.sessions import SessionMiddleware
try:
    from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
except ImportError:
    ProxyHeadersMiddleware = None  # Optional; skip if unavailable
from pydantic import BaseModel
from typing import List, Optional, Literal, Dict, Any
from datetime import datetime, date
from uuid import UUID
import anthropic
import os
from dotenv import load_dotenv
import io
import json
import httpx
from sqlalchemy.orm import Session
from time import perf_counter
import re
try:
    import boto3  # type: ignore
    from botocore.client import Config as BotoConfig  # type: ignore
    BOTO3_AVAILABLE = True
except Exception:
    boto3 = None  # type: ignore
    BotoConfig = None  # type: ignore
    BOTO3_AVAILABLE = False

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
    ELEVENLABS_AVAILABLE = True
except ImportError:
    ELEVENLABS_AVAILABLE = False
    print("Warning: ElevenLabs not available. Install with: pip install elevenlabs")

# Load environment variables
load_dotenv()

app = FastAPI(title="Comprehension Engine API", version="1.0.0")

# Respect X-Forwarded-* headers when running behind proxies (Railway, Vercel, etc.)
if ProxyHeadersMiddleware is not None:
    app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=["*"])
else:
    print("Warning: ProxyHeadersMiddleware unavailable; proceeding without it.")

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

# Include routes
app.include_router(auth_router)

# ---- Upload presign endpoint ----
class PresignRequest(BaseModel):
    content_type: str
    file_name: Optional[str] = None
    max_size: Optional[int] = 10 * 1024 * 1024  # 10 MB default

class PresignResponse(BaseModel):
    upload_url: str
    file_url: str
    method: str = "PUT"
    fields: Optional[Dict[str, Any]] = None

def _create_s3_client():
    if not BOTO3_AVAILABLE:
        raise HTTPException(status_code=503, detail="Storage not configured: boto3 is not installed")
    region = os.getenv("S3_REGION", "us-east-1")
    access_key = os.getenv("S3_ACCESS_KEY_ID")
    secret_key = os.getenv("S3_SECRET_ACCESS_KEY")
    use_accel = os.getenv("S3_USE_ACCELERATE", "false").lower() == "true"
    session = boto3.session.Session()
    return session.client(
        "s3",
        region_name=region,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=BotoConfig(s3={"use_accelerate_endpoint": use_accel})
    )

@app.post("/api/uploads/presign", response_model=PresignResponse)
async def presign_upload(req: PresignRequest, current_user: User = Depends(get_current_user)):
    if not BOTO3_AVAILABLE:
        raise HTTPException(status_code=503, detail="Storage not configured: install boto3 on the server")
    # Basic validation
    allowed_types = {"image/png", "image/jpeg", "image/webp", "image/heic"}
    if req.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Unsupported content type")
    if (req.max_size or 0) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large")

    bucket = os.getenv("S3_BUCKET_NAME")
    if not bucket:
        raise HTTPException(status_code=500, detail="Storage bucket not configured")

    key_prefix = f"uploads/{current_user.id}/"
    file_name = req.file_name or "upload"
    # Avoid path traversal
    safe_name = "".join(ch for ch in file_name if ch.isalnum() or ch in (".", "-", "_")) or "upload"
    key = key_prefix + safe_name

    ttl = int(os.getenv("S3_PRESIGN_TTL_SECONDS", "300"))
    s3 = _create_s3_client()
    try:
        upload_url = s3.generate_presigned_url(
            ClientMethod="put_object",
            Params={"Bucket": bucket, "Key": key, "ContentType": req.content_type},
            ExpiresIn=ttl
        )
        # Public URL assumption: bucket has public read or CloudFront in front. Adjust as needed.
        region = os.getenv("S3_REGION", "us-east-1")
        file_url = f"https://{bucket}.s3.{region}.amazonaws.com/{key}"
        return PresignResponse(upload_url=upload_url, file_url=file_url, method="PUT")
    except Exception as e:
        print(f"presign failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to create presigned URL")

# Initialize Anthropic client with persistent HTTP/2 session (keep-alive)
api_key = os.getenv("ANTHROPIC_API_KEY")
if not api_key or api_key == "your-api-key-here":
    raise ValueError("ANTHROPIC_API_KEY environment variable is not set or is invalid")
try:
    _anthropic_http = httpx.Client(
        http2=True,
        timeout=httpx.Timeout(30.0),
        limits=httpx.Limits(max_keepalive_connections=10, max_connections=20),
        headers={"Connection": "keep-alive"},
    )
except Exception as e:
    print(f"Warning: HTTP/2 not available for Anthropic client, falling back to HTTP/1.1 keep-alive: {e}")
    _anthropic_http = httpx.Client(
        http2=False,
        timeout=httpx.Timeout(30.0),
        limits=httpx.Limits(max_keepalive_connections=10, max_connections=20),
        headers={"Connection": "keep-alive"},
    )
try:
    client = anthropic.Anthropic(api_key=api_key, http_client=_anthropic_http)
except TypeError:
    # Older SDKs may not accept http_client; fall back to default construction
    client = anthropic.Anthropic(api_key=api_key)

# Initialize ElevenLabs if available
if ELEVENLABS_AVAILABLE:
    elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")
    if elevenlabs_api_key and elevenlabs_api_key != "your-elevenlabs-api-key-here":
        set_api_key(elevenlabs_api_key)
        print("ElevenLabs API configured successfully")
    else:
        print("Warning: ELEVENLABS_API_KEY not set. TTS will use fallback.")

# Persistent HTTP client for ElevenLabs (keep-alive, HTTP/2 when supported)
try:
    _eleven_http = httpx.Client(
        http2=True,
        timeout=httpx.Timeout(30.0),
        limits=httpx.Limits(max_keepalive_connections=10, max_connections=20),
        headers={
            "Connection": "keep-alive",
            # xi-api-key header is set per-request below to avoid logging in client repr
        },
    )
except Exception as e:
    print(f"Warning: HTTP/2 not available for ElevenLabs client, falling back to HTTP/1.1 keep-alive: {e}")
    _eleven_http = httpx.Client(
        http2=False,
        timeout=httpx.Timeout(30.0),
        limits=httpx.Limits(max_keepalive_connections=10, max_connections=20),
        headers={
            "Connection": "keep-alive",
        },
    )

def eleven_stream_tts(
    text: str,
    voice_id: str,
    latency: int = 1,
    chunk_size: int = 2048,
    model_id: str = "eleven_multilingual_v2",
    output_mime: str = "audio/mpeg",
):
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key or api_key == "your-elevenlabs-api-key-here":
        raise HTTPException(status_code=503, detail="ElevenLabs API key not configured")
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream"
    params = {"optimize_streaming_latency": str(latency)}
    json_payload = {"text": text, "model_id": model_id}
    headers = {"xi-api-key": api_key, "accept": output_mime}
    with _eleven_http.stream("POST", url, params=params, json=json_payload, headers=headers) as resp:
        resp.raise_for_status()
        for chunk in resp.iter_bytes(chunk_size=chunk_size):
            if chunk:
                yield chunk

def eleven_tts_once(
    text: str,
    voice_id: str,
    model_id: str = "eleven_multilingual_v2",
    output_mime: str = "audio/mpeg",
) -> bytes:
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key or api_key == "your-elevenlabs-api-key-here":
        raise HTTPException(status_code=503, detail="ElevenLabs API key not configured")
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    json_payload = {"text": text, "model_id": model_id}
    headers = {"xi-api-key": api_key, "accept": output_mime}
    resp = _eleven_http.post(url, json=json_payload, headers=headers)
    resp.raise_for_status()
    return resp.content

# (ffmpeg-based PCM transcoding removed by request)

class ChatMessage(BaseModel):
    content: str
    role: str = "user"

class ChatRequest(BaseModel):
    message: str
    conversation_history: Optional[List[dict]] = []
    conversation_id: Optional[UUID] = None
    start_new: Optional[bool] = False
    # New: mode awareness for prompt composition
    mode: Optional[Literal["text", "voice"]] = None
    # Optional: image attachments uploaded via presign flow
    attachments: Optional[List[Dict[str, Any]]] = None

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
    attachments: Optional[List[Dict[str, Any]]] = None

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
    """Convert text to speech using ElevenLabs (streaming)."""
    if not ELEVENLABS_AVAILABLE:
        raise HTTPException(status_code=503, detail="ElevenLabs TTS not available")
    
    try:
        # Validate voice ID
        valid_voice_ids = [voice.id for voice in AVAILABLE_VOICES]
        if request.voice_id not in valid_voice_ids:
            raise HTTPException(status_code=400, detail="Invalid voice ID")

        latency = int(os.getenv("ELEVENLABS_STREAM_LATENCY", "1"))
        chunk_size = int(os.getenv("ELEVENLABS_STREAM_CHUNK_SIZE", "2048"))

        def audio_iter():
            try:
                for chunk in eleven_stream_tts(
                    text=request.text,
                    voice_id=request.voice_id,
                    latency=latency,
                    chunk_size=chunk_size,
                    model_id="eleven_multilingual_v2",
                ):
                    if chunk:
                        yield chunk
            except Exception:
                # Fallback one-shot
                audio_bytes = eleven_tts_once(
                    text=request.text,
                    voice_id=request.voice_id,
                    model_id="eleven_multilingual_v2",
                )
                if audio_bytes:
                    yield audio_bytes

        return StreamingResponse(
            audio_iter(),
            media_type="audio/mpeg",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
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

        # Low-risk latency reduction: when conversation_id exists, rebuild last K turns on backend
        # to avoid large payloads from the frontend on every turn.
        MAX_TURNS = 10
        if request.conversation_id and not request.start_new:
            try:
                # Verify the conversation belongs to the current user
                convo = (
                    db.query(Conversation)
                    .filter(Conversation.id == request.conversation_id)
                    .first()
                )
                if convo and convo.user_id == current_user.id:
                    last_turns = (
                        db.query(ConversationTurn)
                        .filter(ConversationTurn.conversation_id == convo.id)
                        .order_by(ConversationTurn.turn_number.desc())
                        .limit(MAX_TURNS)
                        .all()
                    )
                    for t in reversed(last_turns):
                        messages.append({"role": "user", "content": t.user_input})
                        messages.append({"role": "assistant", "content": t.ai_response})
                else:
                    # Ownership mismatch or missing conversation: fall back gracefully
                    if request.conversation_history:
                        for msg in request.conversation_history:
                            if msg.get("role") == "user":
                                messages.append({"role": "user", "content": msg["content"]})
                            elif msg.get("role") == "assistant":
                                messages.append({"role": "assistant", "content": msg["content"]})
            except Exception as e:
                # Do not fail chat if DB is unavailable; log and fall back to client-provided history
                try:
                    print(f"[CE] History rebuild skipped due to error: {e}")
                except Exception:
                    pass
                if request.conversation_history:
                    for msg in request.conversation_history:
                        if msg.get("role") == "user":
                            messages.append({"role": "user", "content": msg["content"]})
                        elif msg.get("role") == "assistant":
                            messages.append({"role": "assistant", "content": msg["content"]})
        else:
            # Fallback to any provided conversation_history from the client
            if request.conversation_history:
                for msg in request.conversation_history:
                    if msg.get("role") == "user":
                        messages.append({"role": "user", "content": msg["content"]})
                    elif msg.get("role") == "assistant":
                        messages.append({"role": "assistant", "content": msg["content"]})

        # Add current user message (mention attachments if present for LLM context)
        user_text = request.message
        if request.attachments:
            try:
                mention_lines = []
                for a in request.attachments[:4]:
                    if not isinstance(a, dict):
                        continue
                    url = a.get("url")
                    alt = a.get("alt") or "image"
                    if url:
                        mention_lines.append(f"Attached image: {url} (alt: {alt})")
                if mention_lines:
                    user_text = user_text + "\n\n" + "\n".join(mention_lines)
            except Exception:
                pass
        messages.append({"role": "user", "content": user_text})
        
        # Get system prompt from prompt manager with task/mode composition
        system_prompt = prompt_manager.get_prompt(task="chat", mode=request.mode or "text")
        # Append an explicit enforcement line for voice mode to reduce verbosity further
        if (request.mode or "text") == "voice":
            system_prompt = (
                "MODE=VOICE ENFORCEMENT\n"
                "- Strictly limit to 1–2 short sentences, no lists, no markdown.\n"
                "- End with a question.\n\n" + system_prompt
            )
        # Guard: chat task must not emit JSON or code blocks
        system_prompt = (
            "IMPORTANT CHAT RULES\n"
            "- Do not output JSON, code blocks, or structured data in chat responses.\n"
            "- Use plain sentences only.\n\n" + system_prompt
        )
        try:
            print(f"[CE] /api/chat mode={request.mode or 'text'}")
        except Exception:
            pass
        
        # Compute token budget (reduce by 50% in voice mode)
        base_max_tokens = 1000
        is_voice_mode = (request.mode or "text") == "voice"
        max_tokens = int(base_max_tokens * 0.5) if is_voice_mode else base_max_tokens
        try:
            print(f"[CE] /api/chat max_tokens={max_tokens} (base={base_max_tokens}, voice={is_voice_mode})")
        except Exception:
            pass

        # Call Claude Sonnet 4 with dynamic system prompt
        t1_send = perf_counter()
        try:
            print(f"[VM] t1 sending to claude", {"t_ms": int((t1_send - start_time) * 1000)})
        except Exception:
            pass
        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=max_tokens,
            system=system_prompt,
            messages=messages
        )
        t2_recv = perf_counter()
        try:
            print(
                f"[VM] t2 received from claude",
                {"t_ms": int((t2_recv - start_time) * 1000), "claude_ms": int((t2_recv - t1_send) * 1000)}
            )
        except Exception:
            pass
        
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
                    attachments=request.attachments if request.attachments else None,
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


# ---- Tutor utilities: Affect classifier & Next-question generator ----

class AffectRequest(BaseModel):
    last_two_user_turns: List[str]


class AffectResponse(BaseModel):
    affect: Literal["engaged", "confused", "frustrated", "bored", "neutral"]
    confidence: float
    evidence: Optional[str] = None


@app.post("/api/tutor/affect", response_model=AffectResponse)
async def classify_affect(payload: AffectRequest):
    try:
        system_prompt = prompt_manager.get_prompt(task="affect")
        # Build a minimal user message instructing JSON-only output
        turns_joined = "\n\n".join([f"Turn {i+1}: {t}" for i, t in enumerate(payload.last_two_user_turns[-2:])])
        user_msg = (
            "Classify learner affect for the last two user turns. "
            "Return JSON only.\n\n"
            f"User turns:\n{turns_joined}"
        )
        resp = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=200,
            system=system_prompt,
            messages=[{"role": "user", "content": user_msg}],
        )
        text = resp.content[0].text if resp.content else "{}"
        import json, re
        match = re.search(r"\{[\s\S]*\}", text)
        json_str = match.group(0) if match else text
        data = json.loads(json_str)
        return AffectResponse(
            affect=data.get("affect", "neutral"),
            confidence=float(data.get("confidence", 0.0)),
            evidence=data.get("evidence")
        )
    except Exception as e:
        print(f"Affect classification failed: {e}")
        raise HTTPException(status_code=500, detail="Affect classification failed")


class NextQuestionContext(BaseModel):
    concept_id: Optional[str] = None
    recent_performance: Optional[str] = None  # brief summary text
    recent_affect: Optional[str] = None       # engaged|confused|...
    mode: Optional[Literal["text", "voice"]] = None


@app.post("/api/tutor/next-question")
async def generate_next_question(ctx: NextQuestionContext):
    try:
        system_prompt = prompt_manager.get_prompt(task="next_question")
        # Provide compact context; enforce JSON-only output in the user message
        context_lines = []
        if ctx.concept_id:
            context_lines.append(f"concept_id: {ctx.concept_id}")
        if ctx.recent_performance:
            context_lines.append(f"recent_performance: {ctx.recent_performance}")
        if ctx.recent_affect:
            context_lines.append(f"recent_affect: {ctx.recent_affect}")
        if ctx.mode:
            context_lines.append(f"mode: {ctx.mode}")
        context_blob = "\n".join(context_lines) if context_lines else "(no extra context)"

        user_msg = (
            "Generate the single best next question for this learner now. "
            "Return JSON only matching the schema described in the system prompt.\n\n"
            f"Context:\n{context_blob}"
        )

        resp = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=600,
            system=system_prompt,
            messages=[{"role": "user", "content": user_msg}],
        )

        text = resp.content[0].text if resp.content else "{}"
        import json, re
        match = re.search(r"\{[\s\S]*\}", text)
        json_str = match.group(0) if match else text
        data = json.loads(json_str)

        # Optional: validate shape lightly (presence of keys)
        if not (isinstance(data, dict) and "item" in data):
            raise ValueError("Invalid next-question JSON")

        return data
    except Exception as e:
        print(f"Next-question generation failed: {e}")
        raise HTTPException(status_code=500, detail="Next-question generation failed")

@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest, current_user: User = Depends(get_current_user)):
    """Stream assistant text deltas using Anthropic streaming via Server-Sent Events (SSE)."""
    def sse_generator():
        try:
            # Build minimal message list (frontend may later omit history when conversation_id is used)
            messages: List[dict] = []
            if request.conversation_history:
                for msg in request.conversation_history:
                    role = msg.get("role")
                    content = msg.get("content")
                    if role in ("user", "assistant") and content:
                        messages.append({"role": role, "content": content})
            messages.append({"role": "user", "content": request.message})

            # Compose system prompt similar to /api/chat
            system_prompt = prompt_manager.get_prompt(task="chat", mode=request.mode or "text")
            if (request.mode or "text") == "voice":
                system_prompt = (
                    "MODE=VOICE ENFORCEMENT\n"
                    "- Strictly limit to 1–2 short sentences, no lists, no markdown.\n"
                    "- End with a question.\n\n" + system_prompt
                )
            system_prompt = (
                "IMPORTANT CHAT RULES\n"
                "- Do not output JSON, code blocks, or structured data in chat responses.\n"
                "- Use plain sentences only.\n\n" + system_prompt
            )

            base_max_tokens = 800
            is_voice_mode = (request.mode or "text") == "voice"
            max_tokens = int(base_max_tokens * 0.25) if is_voice_mode else base_max_tokens

            with client.messages.stream(
                model="claude-3-5-sonnet-20241022",
                max_tokens=max_tokens,
                system=system_prompt,
                messages=messages,
            ) as stream:
                for event in stream:
                    event_type = getattr(event, "type", None)
                    if event_type == "content_block_delta":
                        delta_obj = getattr(event, "delta", None)
                        text_piece = ""
                        if hasattr(delta_obj, "text") and isinstance(getattr(delta_obj, "text"), str):
                            text_piece = getattr(delta_obj, "text")
                        elif isinstance(delta_obj, dict):
                            text_piece = delta_obj.get("text", "")
                        elif isinstance(delta_obj, str):
                            text_piece = delta_obj
                        if text_piece:
                            yield f"data: {json.dumps({'delta': text_piece})}\n\n"
                    elif event_type == "message_stop":
                        yield "data: {\"done\": true}\n\n"
        except Exception as e:
            try:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
            finally:
                yield "data: {\"done\": true}\n\n"

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable proxy buffering (nginx, etc.)
        },
    )

@app.post("/api/voice_chat")
async def voice_chat(
    request: ChatRequest,
    voice_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    raw_request: Request = None,
):
    """Stream synthesized audio by chunking Claude streaming output into sentences and TTS-ing each sentence immediately."""
    if not ELEVENLABS_AVAILABLE:
        raise HTTPException(status_code=503, detail="ElevenLabs TTS not available")

    # Resolve voice id (validate against known voices)
    default_voice = os.getenv("ELEVENLABS_DEFAULT_VOICE", "21m00Tcm4TlvDq8ikWAM")
    selected_voice = voice_id or default_voice
    valid_voice_ids = [voice.id for voice in AVAILABLE_VOICES]
    if selected_voice not in valid_voice_ids:
        raise HTTPException(status_code=400, detail="Invalid voice ID")

    # Resolve conversation (create or reuse) BEFORE starting the stream so we can place it in headers
    conversation = None
    header_convo_id = None
    try:
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
            # Latest active or new
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
        header_convo_id = str(conversation.id)
    except Exception as e:
        print(f"voice_chat: pre-resolution failed: {e}")
        conversation = None
        header_convo_id = None

    # --- Format negotiation ---
    pcm_env_enabled = os.getenv("PCM_STREAMING_ENABLED", "false").lower() == "true"
    accept_header = ""
    client_platform = ""
    try:
        if raw_request is not None:
            accept_header = (raw_request.headers.get("accept") or "").lower()
            client_platform = (raw_request.headers.get("x-client-platform") or "").lower()
    except Exception:
        pass
    # iOS requests PCM; web stays MP3. Use Accept header and/or client hint.
    pcm_requested = pcm_env_enabled and (("audio/pcm" in accept_header) or (client_platform == "ios"))

    def audio_stream():
        try:
            start_time = perf_counter()
            conversation_id_str: Optional[str] = str(conversation.id) if conversation else None

            # Build messages similar to /api/chat/stream
            messages: List[dict] = []
            if request.conversation_history:
                for msg in request.conversation_history:
                    role = msg.get("role")
                    content = msg.get("content")
                    if role in ("user", "assistant") and content:
                        messages.append({"role": role, "content": content})
            messages.append({"role": "user", "content": request.message})

            # Compose system prompt (voice mode rules enforced)
            system_prompt = prompt_manager.get_prompt(task="chat", mode=request.mode or "voice")
            system_prompt = (
                "MODE=VOICE ENFORCEMENT\n"
                "- Strictly limit to 1–2 short sentences, no lists, no markdown.\n"
                "- End with a question.\n\n" + system_prompt
            )
            system_prompt = (
                "IMPORTANT CHAT RULES\n"
                "- Do not output JSON, code blocks, or structured data in chat responses.\n"
                "- Use plain sentences only.\n\n" + system_prompt
            )

            base_max_tokens = 800
            max_tokens = int(base_max_tokens * 0.20)

            # Sentence buffering
            buffer = ""
            # Accumulate full assistant text for persistence
            assistant_text = ""

            with client.messages.stream(
                model="claude-3-5-sonnet-20241022",
                max_tokens=max_tokens,
                system=system_prompt,
                messages=messages,
            ) as stream:
                for event in stream:
                    event_type = getattr(event, "type", None)
                    if event_type == "content_block_delta":
                        delta_obj = getattr(event, "delta", None)
                        text_piece = ""
                        if hasattr(delta_obj, "text") and isinstance(getattr(delta_obj, "text"), str):
                            text_piece = getattr(delta_obj, "text")
                        elif isinstance(delta_obj, dict):
                            text_piece = delta_obj.get("text", "")
                        elif isinstance(delta_obj, str):
                            text_piece = delta_obj
                        if text_piece:
                            buffer += text_piece
                            # Emit full sentences as they become available
                            while True:
                                m = re.search(r"([\s\S]*?[\.!?])\s+", buffer)
                                if not m:
                                    break
                                sentence = m.group(1)
                                buffer = buffer[m.end():]
                                assistant_text += sentence
                                # Stream TTS for this sentence
                                try:
                                    latency = int(os.getenv("ELEVENLABS_STREAM_LATENCY", "1"))
                                    chunk_size = int(os.getenv("ELEVENLABS_STREAM_CHUNK_SIZE", "2048"))
                                    for chunk in eleven_stream_tts(
                                        text=sentence,
                                        voice_id=selected_voice,
                                        latency=latency,
                                        chunk_size=chunk_size,
                                        model_id="eleven_multilingual_v2",
                                        output_mime=("audio/pcm" if pcm_requested else "audio/mpeg"),
                                    ):
                                        if chunk:
                                            yield chunk
                                except Exception:
                                    # Fallback one-shot in requested format
                                    try:
                                        audio_bytes = eleven_tts_once(
                                            text=sentence,
                                            voice_id=selected_voice,
                                            model_id="eleven_multilingual_v2",
                                            output_mime=("audio/pcm" if pcm_requested else "audio/mpeg"),
                                        )
                                        if audio_bytes:
                                            yield audio_bytes
                                    except Exception:
                                        pass
                    elif event_type == "message_stop":
                        break

            # Flush any remaining buffer
            if buffer.strip():
                assistant_text += buffer
                try:
                    latency = int(os.getenv("ELEVENLABS_STREAM_LATENCY", "1"))
                    chunk_size = int(os.getenv("ELEVENLABS_STREAM_CHUNK_SIZE", "2048"))
                    for chunk in eleven_stream_tts(
                        text=buffer,
                        voice_id=selected_voice,
                        latency=latency,
                        chunk_size=chunk_size,
                        model_id="eleven_multilingual_v2",
                        output_mime=("audio/pcm" if pcm_requested else "audio/mpeg"),
                    ):
                        if chunk:
                            yield chunk
                except Exception:
                    audio_bytes = eleven_tts_once(
                        text=buffer,
                        voice_id=selected_voice,
                        model_id="eleven_multilingual_v2",
                        output_mime=("audio/pcm" if pcm_requested else "audio/mpeg"),
                    )
                    if audio_bytes:
                        yield audio_bytes
            # Persist turn at the end if we resolved a conversation
            try:
                if conversation_id_str is not None:
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
                        ai_response=assistant_text,
                        response_time_ms=elapsed_ms,
                        voice_used=voice_id or os.getenv("ELEVENLABS_DEFAULT_VOICE", "21m00Tcm4TlvDq8ikWAM"),
                    )
                    db.add(turn)
                    db.commit()
            except Exception as persist_err:
                print(f"voice_chat: failed to persist turn: {persist_err}")

        except Exception as e:
            # Log and end stream gracefully
            try:
                print(f"/api/voice_chat failed: {e}")
            except Exception:
                pass

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    if header_convo_id:
        headers["X-Conversation-Id"] = header_convo_id
    headers["X-Audio-Format"] = ("pcm" if pcm_requested else "mp3")

    return StreamingResponse(
        audio_stream(),
        media_type=("audio/pcm" if pcm_requested else "audio/mpeg"),
        headers=headers,
    )

@app.get("/api/conversations", response_model=List[ConversationSummary])
async def list_conversations(limit: int = 20, offset: int = 0, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        from database.models import Conversation, ConversationTurn

        def to_iso(value: Any) -> Optional[str]:
            try:
                if value is None:
                    return None
                if isinstance(value, (datetime, date)):
                    return value.isoformat()
                # Some drivers may already return ISO strings
                return str(value)
            except Exception:
                return None

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
            # Select only needed columns to maintain compatibility with pre-attachments schema
            ts_row = (
                db.query(ConversationTurn.timestamp)
                .filter(ConversationTurn.conversation_id == c.id)
                .order_by(ConversationTurn.timestamp.desc())
                .first()
            )
            last_ts = ts_row[0] if (isinstance(ts_row, tuple) or isinstance(ts_row, list)) else ts_row
            turn_count = (
                db.query(ConversationTurn.id)
                .filter(ConversationTurn.conversation_id == c.id)
                .count()
            )
            summaries.append(ConversationSummary(
                id=c.id,
                title=c.title,
                topic=c.topic,
                created_at=to_iso(c.created_at),
                updated_at=to_iso(c.updated_at),
                is_active=c.is_active,
                last_turn_at=to_iso(last_ts),
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
                comprehension_notes=t.comprehension_notes,
                attachments=getattr(t, 'attachments', None)
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