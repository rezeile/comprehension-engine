## Web Voice Mode Latency Plan

### Goals
- First audio ≤ 1.0s from Claude first token.
- Playback starts while audio downloads (no full-blob wait).

### Quick wins
- Replace Blob-based TTS with streaming via MediaSource Extensions (MSE) and `response.body`.
- Lower TTS bitrate to cut initial bytes.
- Use Claude Haiku 3.5 for voice mode; concise prompt.

### Scope for this iteration
- Implement two items (no optional STT streaming yet):
  1) Replace Blob TTS with MSE streaming using `response.body`.
  2) Consume `/api/chat/stream` SSE and trigger early TTS on sentence boundaries.

---

## Detailed implementation plan (frontend)

### 1) Replace Blob TTS with MSE streaming using `response.body`

Targeted areas:
- `src/services/VoiceService.ts`
  - Current: `textToSpeech(text, voiceId)` does `response.blob()` → returns a Blob, which delays playback until full download.
  - Plan: add a new `streamTtsToAudioElement(text: string, voiceId: string, audioEl: HTMLAudioElement)` method that:
    - Calls `POST /api/tts` and checks `res.body` is available.
    - Creates a `MediaSource` and `SourceBuffer('audio/mpeg')`.
    - Reads `res.body.getReader()` and appends chunks to the SourceBuffer, awaiting `updateend` each time.
    - Ends the stream with `mediaSource.endOfStream()`.
  - Keep existing `textToSpeech` for fallback/legacy; prefer the new streaming method when voice mode is enabled.

- `src/hooks/useVoiceSynthesis.ts`
  - Current: `speakWithElevenLabs` fetches a Blob via `VoiceService.textToSpeech`, then creates a URL and plays it with `new Audio(url)`.
  - Plan:
    - Add an `HTMLAudioElement` instance (e.g., created once and persisted via `useRef`) for streaming playback.
    - Introduce a new function `speakWithElevenLabsStreaming(text, selectedVoiceId)` that:
      - Ensures only one in-flight request (`ttsInFlightRef`) and not currently speaking.
      - Cancels Web Speech API if active.
      - Uses the new `VoiceService.streamTtsToAudioElement(text, voiceId, audioEl)`.
      - Hooks `audioEl.onplay` to flip `isSpeaking` true and trigger `onStart`.
      - Hooks `audioEl.onended`/`onerror` to clear state, revoke resources, and optionally fallback to Web Speech API on error.
    - Update main `speak` to prefer streaming path when `useElevenLabs` is true, otherwise fallback to Web Speech API (or Blob for old browsers).
    - Add small buffering guard: if `audioEl.readyState` is `HAVE_ENOUGH_DATA` or `HAVE_FUTURE_DATA` after first append, call `audioEl.play()` immediately to minimize start time.


Testing plan:
- Devtools network: confirm `/api/tts` returns chunked transfer and audio starts before full download.
- Add console timings for t2 (first chunk appended) and t3 (audio `onplay`).

### 2) Consume `/api/chat/stream` SSE and trigger early TTS on sentence boundaries

Targeted areas:
- `src/hooks/useChat.ts`
  - Current: `sendMessageToBackend` posts to `/api/chat` and waits for full JSON; no streaming.
  - Plan:
    - Add `sendMessageStreamed(message: string)` that:
      - Builds `ChatRequest` similar to existing method (stop sending full `conversation_history` once `conversation_id` is known, if we adopt that protocol change later).
      - Opens an EventSource-like stream using `fetch` with `Accept: text/event-stream` or `EventSource` polyfill (fetch reader is preferred for better control).
      - Parses SSE lines incrementally; when a `data: {"delta":"..."}` arrives, append to a local `currentAssistantText` buffer and update UI via a temporary “streaming assistant” message (create message on first delta; update message content on subsequent deltas).
      - On `done`, finalize the message and clear any streaming state.
    - Sentence boundary detection: for each incoming delta, append to a `ttsBuffer`. When regex `([\.!?])\s+` is matched, extract the sentence and invoke early TTS (see below). Keep leftover in `ttsBuffer`.
    - Handle abort/cancellation: expose a controller to cancel the request when user navigates away.

- Early TTS integration
  - In `useChat.ts`, accept optional callbacks/hooks to trigger TTS on early sentences (or import the voice synthesis hook inside Chat container).
  - On sentence boundary, call `useVoiceSynthesis.speak(text, voiceId, true)` using the new streaming pathway. Gate with a simple debounce so we don’t overlap sentences if appending quickly.
  - If the user has voice output disabled, skip TTS.

- `src/components/ChatInterface.tsx`
  - Current: likely calls `useChat.sendMessage` and waits for the full response.
  - Plan:
    - Wire a new `sendMessageStreamed` path when voice mode is on (or when the user enables streaming).
    - Render a “typing” indicator until first delta arrives, then replace it with a live-updating assistant message.
    - Ensure auto-scroll keeps the latest token in view.

Data/State considerations:
- Messages array should temporarily include a streaming assistant message with a stable id, updated in place.
- When `done` arrives, finalize and keep it as a normal assistant message.
- Keep `ttsBuffer` per in-flight turn; reset on completion.

Error handling:
- If the SSE connection errors, close gracefully and add a compact error assistant message.
- If early TTS fails (network or autoplay restriction), fallback silently.

Testing plan:
- Simulate slow SSE: verify assistant text updates incrementally and TTS starts on the first sentence.
- Confirm no duplicate TTS triggers when sentences arrive in small chunks (use a guard flag per sentence).

---

## Acceptance checklist
- TTS playback starts before the full audio is downloaded (MSE path).
- `/api/chat/stream` deltas render incrementally in the chat UI.
- Early TTS triggers on the first sentence boundary during streaming.
- No overlapping audio when sentences arrive quickly (guarded by in-flight state/debounce).
- Fallbacks: if streaming unsupported, Blob or Web Speech API is used.

## Follow-ups (not in this iteration)
- Optional: streaming STT to backend for even earlier Claude start.
- Move to `/api/voice_chat` on web for single round-trip audio.

### Claude streaming (Phase 2)
- Consume `/api/chat/stream` (SSE) and render deltas.
- Trigger TTS when first sentence boundary is detected.

### TTS streaming (Phase 3)
- Use existing `/api/tts` but read `res.body` and append chunks to a `SourceBuffer('audio/mpeg')`.
- Preferred: call `/api/voice_chat` to receive audio that maps directly to streamed sentences.

Sketch MSE appender:
```ts
const mediaSource = new MediaSource();
audio.src = URL.createObjectURL(mediaSource);
await once(mediaSource, 'sourceopen');
const sb = mediaSource.addSourceBuffer('audio/mpeg');
const reader = res.body!.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) { mediaSource.endOfStream(); break; }
  await append(sb, value);
}
```

### Observability
- Correlation ID per turn; log t0 (send), t1 (first Claude token), t2 (first audio byte appended), t3 (audio onplay).



