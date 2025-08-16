# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Frontend (React + TypeScript)
```bash
cd frontend
npm install          # Install dependencies
npm start           # Start development server (localhost:3000)
npm test            # Run tests
npm run build       # Build for production
```

### Backend (FastAPI + Python)
```bash
cd backend
source venv/bin/activate    # Activate virtual environment
pip install -r requirements.txt    # Install dependencies
python main.py      # Start server (localhost:8000)
./start.sh          # Alternative startup script
```

### Database Operations
```bash
cd backend
alembic upgrade head    # Apply migrations
alembic revision --autogenerate -m "description"    # Create new migration
python test_auth.py     # Test authentication setup
```

### Testing Commands
```bash
# Backend health checks
curl http://localhost:8000/health
curl http://localhost:8000/health/db

# Frontend tests
cd frontend && npm test

# Backend specific tests
cd backend
python test_prompts.py
python test_imports.py
```

## Architecture Overview

### Project Structure
- **Frontend**: React 19 + TypeScript with modern CSS and Mixpanel analytics
- **Backend**: FastAPI with Claude Sonnet 4 integration, OAuth authentication, and PostgreSQL
- **Database**: PostgreSQL with SQLAlchemy ORM and Alembic migrations
- **Voice**: ElevenLabs TTS integration with voice mode capabilities

### Key Components

#### Frontend Architecture
- **App.tsx**: Main application with AuthProvider and Mixpanel initialization
- **ChatInterface**: Central chat component orchestrating the conversation flow
- **useChat hook**: Core chat logic managing state, API calls, and message flow
- **VoiceMode**: Voice recognition and synthesis for hands-free interaction
- **AuthContext**: OAuth-based authentication state management
- **FormattedMessage**: React-markdown with syntax highlighting for AI responses

#### Backend Architecture
- **main.py**: FastAPI application with CORS, authentication, and API endpoints
- **prompts/**: Dynamic prompt management system with environment-based switching
  - `prompt_manager`: Global instance handling prompt variants
  - `base_prompts.py`: Defined prompt templates (default, empathetic tutor, markdown)
  - `prompt_variants.py`: Runtime switching logic between prompts
- **database/**: SQLAlchemy models and connection management
  - User, Conversation, ConversationTurn models with UUID primary keys
  - PostgreSQL with proper relationships and constraints
- **auth/**: OAuth implementation with Google OAuth2 and JWT handling
- **api/**: Modular route organization

#### Key Integrations
- **Anthropic Claude**: Sonnet 4 model with dynamic system prompts
- **ElevenLabs**: TTS with pre-configured voices (Rachel, Domi, Bella, Antoni)
- **Google OAuth**: Authentication with session management
- **Mixpanel**: Analytics tracking for user interactions

### Environment Configuration
- **Frontend**: `REACT_APP_BACKEND_URL`, `REACT_APP_MIXPANEL_TOKEN`
- **Backend**: `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `DATABASE_URL`, OAuth credentials
- **Prompt System**: `ACTIVE_PROMPT_VARIANT` for runtime prompt switching

### Database Schema
- **users**: UUID-based user accounts with Google OAuth integration
- **conversations**: Chat sessions with topic tracking and user relationships
- **conversation_turns**: Individual message pairs with comprehension analysis fields

### Voice and Audio Features
- Real-time voice recognition using Web Speech API
- ElevenLabs TTS with multiple voice options
- Voice mode with transcription display and audio controls
- Background voice processing with React hooks

### Authentication Flow
- Google OAuth2 integration with backend JWT handling
- Protected routes with authentication context
- Session persistence and user state management
- Cookie-based authentication for production deployment

## Development Notes

### Running in Development
Start backend first (port 8000), then frontend (port 3000). The frontend proxies API calls to the backend.

### Prompt Management
The system uses a dynamic prompt switching mechanism. Change prompts via environment variables or the admin API endpoints (`/api/admin/prompts/*`).

### Database Migrations
Use Alembic for all schema changes. The system supports both PostgreSQL (production) and SQLite (development).

### Voice Integration
Voice features require HTTPS in production due to Web Speech API constraints. ElevenLabs TTS is optional and degrades gracefully.