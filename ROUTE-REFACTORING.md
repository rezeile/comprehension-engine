## Backend Route Refactoring Plan

### Goals
- Reduce size/complexity of `backend/main.py` by extracting routes into focused modules.
- Group endpoints by feature area with clear prefixes, tags, and response schemas.
- Centralize shared logic (LLM, TTS, conversation persistence) into services.
- Preserve existing public API paths; optionally introduce cleaner, versioned paths with backwards compatibility.

### Current Route Inventory (from `backend/main.py`)
- Core/Health
  - GET `/` — service banner
  - GET `/health` — service status
  - GET `/health/db` — DB connectivity + basic stats

- Voice/TTS
  - GET `/api/voices` — list ElevenLabs voices
  - POST `/api/tts` — text-to-speech (mp3 stream)

- Chat
  - POST `/api/chat` — chat completion (Claude), persists turn, auto-titling
  - POST `/api/chat/stream` — SSE streaming of assistant deltas

- Tutor Utilities
  - POST `/api/tutor/affect` — classify affect (JSON-only LLM call)
  - POST `/api/tutor/next-question` — generate next question (JSON-only LLM call)

- Conversations
  - GET `/api/conversations` — list summaries for current user
  - PATCH `/api/conversations/{conversation_id}` — update title/is_active/topic
  - GET `/api/conversations/{conversation_id}/turns` — list turns

- Diagnostics
  - GET `/api/cors-test` — quick CORS probe

- Admin/Prompts
  - GET `/api/admin/prompts` — list variants + active
  - GET `/api/admin/prompts/{variant_name}` — get variant details
  - POST `/api/admin/prompts/{variant_name}/activate` — set active variant
  - GET `/api/admin/prompts/status` — prompt system status

- Auth (already modularized in `api/auth_routes.py`, included via `app.include_router(auth_router)`)
  - `/api/auth/*` (login, callback, refresh, me, logout, status, session, dev-login, mobile exchanges)

Notes
- Chat/conversations require `get_current_user`; tutor endpoints currently do not enforce auth.
- Admin endpoints are unauthenticated in `main.py`; should be secured.

### Proposed Module Structure

backend/
- api/
  - `health_routes.py` — `/`, `/health`, `/health/db`
  - `voice_routes.py` — `/api/voices`, `/api/tts`
  - `chat_routes.py` — `/api/chat`, `/api/chat/stream`
  - `tutor_routes.py` — `/api/tutor/affect`, `/api/tutor/next-question`
  - `conversations_routes.py` — `/api/conversations*`
  - `diagnostics_routes.py` — `/api/cors-test`
  - admin/
    - `prompts_routes.py` — `/api/admin/prompts*`
  - (existing) `auth_routes.py` — `/api/auth/*`

- schemas/
  - `chat.py` — `ChatMessage`, `ChatRequest`, `ChatResponse`
  - `voice.py` — `TTSRequest`, `VoiceInfo`
  - `conversation.py` — `ConversationSummary`, `ConversationTurnResponse`, `ConversationUpdate`
  - `tutor.py` — `AffectRequest`, `AffectResponse`, `NextQuestionContext`
  - `common.py` — shared types/utilities

- services/
  - `llm_service.py` — Anthropic client wrapper (sync + streaming), prompt composition helpers
  - `tts_service.py` — ElevenLabs wrapper with fallbacks and options
  - `conversation_service.py` — history rebuild, persistence, auto-title
  - `tutor_service.py` — affect and next-question JSON parsing/validation

- config/
  - Extend `settings.py` with: `MAX_TURNS`, token budgets, TTS defaults, feature flags (e.g., API version prefix, admin guard)

- app bootstrap
  - keep `main.py` minimal: create app, middleware, include routers, startup init

### Routing and Versioning
- Keep current paths operational to avoid breaking clients.
- Introduce canonical, versioned prefixes for new modules: `/api/v1/...` via APIRouter(prefix="/api/v1").
- For a transition period, expose both:
  - Legacy paths (current) — marked `deprecated=True` in route decorators or maintained as thin proxies.
  - New `/api/v1/...` paths — preferred and documented.
- Control version prefix via env `API_VERSION_PREFIX` (default `/api` to match today; `/api/v1` when enabled).

### Security Adjustments
- Admin routes: require `get_current_user` and an `is_admin` check (or env-guarded shared secret) before changing prompt variants.
- Tutor routes: decide policy. Recommended: require auth to personalize by user; otherwise allow optional auth via `get_optional_current_user`.

### Shared Logic Extraction
- Move LLM-calling details (token budgets, voice-mode constraints, JSON extraction) into `services/llm_service.py` to reduce duplication between `/api/chat` and `/api/chat/stream`, and tutor endpoints.
- Move conversation persistence, turn numbering, and title heuristic into `services/conversation_service.py`.
- Move ElevenLabs branching/fallbacks into `services/tts_service.py`.

### Main App Slimming (non-functional changes)
- `main.py` will:
  - Configure middlewares (ProxyHeaders, Session, CORS)
  - Initialize DB on startup
  - Include routers from `api/*` modules
  - Hold no business logic or Pydantic models

### Backwards Compatibility Plan
- Preserve all existing routes and response models.
- Add new canonical routes under `/api/v1/...` using the same schemas.
- For any renamed paths (e.g., consider `/api/voice/tts` instead of `/api/tts`), keep legacy route calling into the new handler and log a deprecation warning.
- Document deprecations in README with a target removal date.

### Incremental Refactoring Steps (Suggested Order)
1) Schemas
   - Create `backend/schemas/*` and move Pydantic models from `main.py`.
   - Update imports in code that references these models.

2) Services
   - Create `services/llm_service.py` and port Claude calls (sync + stream) and prompt composition.
   - Create `services/conversation_service.py` to encapsulate history rebuild, persistence, and auto-title logic.
   - Create `services/tts_service.py` for ElevenLabs generation and options.
   - Create `services/tutor_service.py` for JSON-only patterns and parsing.

3) Route Modules
   - Extract: `health_routes.py`, `diagnostics_routes.py`.
   - Extract: `voice_routes.py` (depends on `tts_service`).
   - Extract: `chat_routes.py` (depends on `llm_service`, `conversation_service`).
   - Extract: `tutor_routes.py` (depends on `llm_service`, `tutor_service`).
   - Extract: `conversations_routes.py` (pure DB, uses schemas, `get_current_user`).
   - Extract: `admin/prompts_routes.py` (guarded).

4) App Wiring
   - In `main.py`, import and `include_router(...)` for each module with appropriate prefixes and tags.
   - Keep existing legacy paths active; optionally add `/api/v1` mounted routers in parallel.

5) Security Tightening
   - Add auth guards to admin routes.
   - Decide and implement auth policy for tutor endpoints.

6) Observability & Config
   - Replace `print` with structured logging; add consistent timing/log fields.
   - Move magic numbers (MAX_TURNS, token budgets) to `config.settings` with env overrides.

7) Tests & Docs
   - Add fast tests using FastAPI TestClient/HTTPX for each module.
   - Update `backend/README.md` with the new layout and route map.
   - Ensure `/docs` shows grouped tags and correct schemas.

### Mapping: Current → Target Modules (paths unchanged)
- `/`, `/health`, `/health/db` → `api/health_routes.py`
- `/api/voices`, `/api/tts` → `api/voice_routes.py`
- `/api/chat`, `/api/chat/stream` → `api/chat_routes.py`
- `/api/tutor/affect`, `/api/tutor/next-question` → `api/tutor_routes.py`
- `/api/conversations*` → `api/conversations_routes.py`
- `/api/cors-test` → `api/diagnostics_routes.py`
- `/api/admin/prompts*` → `api/admin/prompts_routes.py` (add auth)
- `/api/auth/*` → keep in `api/auth_routes.py`

### Risks & Mitigations
- Import churn and circular deps: keep services free of FastAPI imports; route modules depend on services, not vice versa.
- Behavior drift: write parity tests (status codes, response shapes) before moving code.
- Admin security: enforce guard in first extraction PR to avoid accidental exposure.
- Streaming fragility: keep SSE generator minimal; push heavy logic into `llm_service.stream_chat`.

### Rollback Plan
- If issues arise, revert to the previous `main.py` and temporarily disable new routers by commenting out `include_router` calls.
- Because routes are extracted additively, rollback is isolated to router wiring in `main.py`.

### Acceptance Criteria
- `main.py` ≤ ~200 lines, containing only app setup and router inclusion.
- All existing endpoints continue to work (manual smoke test + `/docs`).
- New code passes linters and basic tests; no new runtime warnings.
- Admin routes require authentication.


