### Chat Persistence and History Plan

#### Goals
- **Persist conversation across refresh**: If a user refreshes, they remain in the same conversation.
- **Chat history**: Users can browse and open previous conversations.
- **New Chat**: A clear action to start a new conversation (to the right of the gear button).
- **Security**: Only show a user their own conversations.

#### Note on user IDs
- **Users already use UUIDs** in the backend (`users.id` is a UUID primary key). No change required.

---

## Backend changes

- **1) Schemas (Pydantic)**
  - **ConversationSummary**: `id`, `title`, `topic`, `created_at`, `updated_at`, `is_active`, `last_turn_at`, `turn_count`.
  - **ConversationDetail**: `id`, `title`, `topic`, `created_at`, `updated_at`, `is_active`, `turns: ConversationTurn[]` (paginated or recent slice).
  - **ConversationTurnResponse**: `id`, `turn_number`, `user_input`, `ai_response`, `timestamp`, comprehension fields.
  - Extend existing `ChatRequest` to include:
    - `conversation_id?: UUID`
    - `start_new?: bool`

- **2) Endpoints** (all require auth; enforce ownership by `user_id`)
  - `GET /api/conversations` → list `ConversationSummary` for current user (paginated, newest first).
  - `POST /api/conversations` → create a new conversation (optional `title`/`topic`). Returns `ConversationSummary`.
  - `GET /api/conversations/{conversation_id}` → `ConversationDetail` with a recent page of turns.
  - `GET /api/conversations/{conversation_id}/turns` → list `ConversationTurnResponse` (paginated).
  - `PATCH /api/conversations/{conversation_id}` → update `title` and/or `is_active`.
  - Update existing `POST /api/chat` behavior:
    - If `start_new=True`: create conversation, persist turn there.
    - Else if `conversation_id` provided: append to it (403 if not owned by user).
    - Else: fallback to latest active conversation (current simple strategy).
    - Always return `conversation_id` in response.

- **3) Security/validation**
  - Use `get_current_user` on all routes.
  - 404 for non-existent IDs; 403 for conversations not owned by the user.

- **4) Performance/pagination**
  - Query with `limit`/`offset` (defaults: conversations 20, turns 50).
  - Use existing indexes (`user_id`, `created_at`, `timestamp`).

- **5) Tests**
  - Start new conversation via chat; append to existing; forbidden access to other users' conversations; pagination bounds.

---

## Frontend changes

- **1) Routing**
  - Introduce React Router:
    - `/c/:conversationId` → active conversation route.
    - `/` → redirect to the most recent conversation, or create a new one if none exist.

- **2) Services** (`frontend/src/services/ConversationService.ts`)
  - `listConversations()` → GET `/api/conversations`.
  - `createConversation(title?: string)` → POST `/api/conversations`.
  - `getConversation(conversationId)` → GET `/api/conversations/{id}`.
  - `listTurns(conversationId, params)` → GET `/api/conversations/{id}/turns`.
  - All requests use `credentials: 'include'` and add `Authorization` header from `localStorage` token if present.

- **3) Hooks**
  - `useConversations.ts`:
    - State: `conversations`, `activeConversationId`, `isLoading`, `error`.
    - Actions: `refreshList()`, `selectConversation(id)`, `startNewConversation(title?)`.
  - Update `useChat.ts`:
    - Accept `conversationId` as a parameter.
    - Include `conversation_id` (or `start_new`) in POST body to `/api/chat`.
    - On response, reconcile `conversation_id` with route state.
    - Add `hydrateFromTurns(turns)` to set initial messages from backend.

- **4) Components**
  - `ChatHeader`:
    - Add a "New Chat" button to the right of the gear icon. On click: create conversation → navigate to `/c/:id` → reset local chat state.
  - `ChatInterface`:
    - Read `conversationId` from route params.
    - On mount/param change: fetch turns for `conversationId` and hydrate chat messages.
    - If no `conversationId` present: list conversations and navigate to newest, or create a new one.
  - Optional `ChatHistory` panel/drawer:
    - Shows a list of conversations (title + updated_at). Click to navigate.

- **5) Types**
  - Add `Conversation`, `ConversationSummary`, `ConversationTurn` types in `frontend/src/types/`.

- **6) UX details**
  - Loading skeletons for conversation/turn fetch.
  - When starting a new chat, reset messages to initial welcome.
  - Maintain auto-scroll behavior.
  - Optionally auto-title a conversation from its first turn via `PATCH`.

---

## Minimal slice to meet immediate needs

- Backend: add `GET /api/conversations`, `GET /api/conversations/{id}/turns`; update `POST /api/chat` to accept `conversation_id`/`start_new` and always return `conversation_id`.
- Frontend: add routing with `:conversationId`; hydrate chat from turns on load; add "New Chat" button to create + navigate; update `useChat` to pass through `conversation_id`.

---

## Testing checklist

- Auth user sends messages → turns persist; refresh stays on same conversation.
- New Chat → navigates to new URL; messages reset; persistence works.
- Navigate between conversations; correct history loads.
- Unauthorized access attempts are blocked.
- Pagination returns stable, ordered results.


