from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import anthropic
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="Comprehension Engine API", version="1.0.0")

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Anthropic client
client = anthropic.Anthropic(
    api_key=os.getenv("ANTHROPIC_API_KEY", "your-api-key-here")
)

class ChatMessage(BaseModel):
    content: str
    role: str = "user"

class ChatRequest(BaseModel):
    message: str
    conversation_history: Optional[List[dict]] = []

class ChatResponse(BaseModel):
    response: str
    conversation_id: Optional[str] = None

@app.get("/")
async def root():
    return {"message": "Comprehension Engine API is running!"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "comprehension-engine"}

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
        raise HTTPException(status_code=500, detail=f"Anthropic API error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 