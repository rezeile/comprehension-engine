### Chat History UI and Auto-Titling Implementation Plan

#### Objectives
- Provide an in-app chat history UI that lists a user’s previous conversations with succinct titles.
- Auto-generate a concise title (≤ 3 words) for a conversation shortly after it begins, based on context.
- Clicking a title opens the conversation at route `/c/:id` and hydrates the messages.

---

## Backend changes

### 1) Endpoints
- GET `/api/conversations` (already implemented):
  - Returns list of conversations for the current user with `id`, `title`, `topic`, `created_at`, `updated_at`, `is_active`, `last_turn_at`, `turn_count`.
- GET `/api/conversations/{id}/turns` (already implemented):
  - Returns ordered list of turns for a conversation.
- PATCH `/api/conversations/{id}` (new):
  - Body: `{ title?: string, is_active?: boolean, topic?: string }`.
  - Validations: 404 if not found; 403 if owned by another user.
  - Returns the updated conversation summary.

### 2) Auto-titling logic
- Trigger: After the first successful turn is persisted in `POST /api/chat` when the conversation has no `title`.
- Constraints: Title must be ≤ 3 words, human-readable, and reflect the topic.

Implementation options (choose one; allow toggling by env var):
- Heuristic (default, no extra API usage):
  - Extract prominent nouns/noun-phrases from the first `user_input` and/or early `ai_response` using a simple keyword extraction (e.g., top 1–2 keywords), title case, join by space, truncate to 2–3 words. Fallback to "New Chat" if empty.
- LLM-assisted (optional, if `ENABLE_LLM_TITLES=true`):
  - Make a short, low-token request to generate a ≤ 3-word title. Guardrails: strip punctuation, enforce word count.

Performance and reliability:
- Compute title synchronously only if it adds negligible latency (<50ms heuristic). Otherwise defer: create the turn first, then update title via a follow-up DB update in the same request before returning.
- If title generation fails, skip without failing chat; conversation remains untitled until later turns or a user rename.

### 3) Data model
- No schema changes required. `conversations.title` already exists.

### 4) Tests
- When first turn is added and conversation has no title → title is set (non-empty, ≤ 3 words).
- PATCH title by owner works; non-owner gets 403; non-existent 404.
- Listing and pagination remain stable.

---

## Frontend changes

### 1) New components
- `HistoryDrawer` (new):
  - Desktop (≥1024px): 280–320px left sidebar that can be pinned (persist in `localStorage`).
  - Mobile/tablet: overlay drawer (full-height, left slide-in).
  - Contents: paginated list of `ConversationSummary` items (title + updated_at). If no title, show fallback (e.g., "New Chat").
  - Item click: navigate to `/c/:id` (uses existing routing) and closes the drawer on mobile.
  - Optional: Inline rename affordance (pencil icon) that triggers PATCH.

- `HistoryToggleButton` (optional or integrated into header): Button in `ChatHeader` next to the gear and New Chat to open/close the drawer.

### 2) Hooks/services
- `useConversations.ts` (new):
  - State: `conversations`, `isLoading`, `error`, `isPinned`, `page`, `hasMore`.
  - Actions: `refreshList()`, `loadMore()`, `togglePinned()`, `renameConversation(id, title)`.
  - Persists `isPinned` and last open/selected conversation in `localStorage`.

- `ConversationService` (already created):
  - Add `updateConversation(id, payload)` → PATCH `/api/conversations/{id}`.

### 3) Chat header integration
- Add a "History" button (text-only, same style family as New Chat) to `ChatHeader` that toggles the drawer.
- Maintain parity with existing glass/rounded style.

### 4) Routing and hydration
- Already in place: `/c/:conversationId` and `/c/new`.
- On navigation to `/c/:id`, `ChatInterface` hydrates via `listTurns` (already implemented).

### 5) UX details
- Titles: show up to one line; truncate overflow with ellipsis; tooltip shows full title.
- Empty history state: show helpful message and CTA to start a New Chat.
- Keyboard navigation: Up/Down to move, Enter to open.
- Loading states: Skeleton rows while fetching.
- Error states: Non-blocking toast/toast-like banner.

### 6) Analytics (optional)
- Track drawer open/close, pin/unpin, open conversation, and rename events.

---

## Accessibility
- Ensure `HistoryDrawer` is focus-trapped when open in overlay mode.
- Provide `aria-expanded` and `aria-controls` on the History button.
- Each list item is a button with accessible name (the title and updated time).

---

## Security
- All history endpoints require auth. Ownership enforced server-side (403 when mismatched).
- No titles or content from other users are exposed.

---

## Step-by-step delivery plan (safe, minimal regressions)
1) Backend
   - Add PATCH `/api/conversations/{id}` with auth + ownership checks.
   - Add heuristic title generation in `POST /api/chat` when conversation has no title.
   - Add tests for auto-title and PATCH.

2) Frontend
   - Add `useConversations.ts` and extend `ConversationService` with `updateConversation`.
   - Build `HistoryDrawer` with responsive styles and pagination.
   - Add "History" button in `ChatHeader` to toggle drawer; persist pinning.
   - Wire item click → `navigate('/c/:id')` and hydrate.

3) Polish
   - Inline rename (optional, PATCH on blur/Enter).
   - Skeletons, toasts, a11y focus traps, and analytics events.

4) QA
   - Verify title length and readability across varied chats.
   - Verify ownership and error cases.
   - Confirm no regressions in existing chat, voice mode, and routing.

---

## Example payloads
- PATCH request:
```json
{
  "title": "Algebra Basics"
}
```

- GET `/api/conversations` (excerpt):
```json
[
  {
    "id": "a1b2...",
    "title": "Photosynthesis",
    "updated_at": "2025-08-17T12:34:56Z",
    "is_active": true,
    "turn_count": 7
  }
]
```

---

## Notes
- Title generation should be conservative and human-readable; enforce a maximum of 3 words, strip punctuation, and title-case.
- If no suitable title can be found, keep as "New Chat" until the user renames it or a later heuristic/LLM attempt succeeds.

