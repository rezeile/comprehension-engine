## Voice Mode Latency Diagnosis and Fix Plan

This document traces the voice pipeline end‑to‑end and ranks the biggest contributors to perceived delay, with concrete code‑level fixes for each.

### Current pipeline (observed)

1. Frontend transcribes speech (Web Speech API).
2. On send, frontend calls `POST /api/chat` with the entire conversation history (see `frontend/src/hooks/useChat.ts`).
3. Backend calls Anthropic with a non‑streaming request (see `backend/main.py -> chat()`), waits for the full model response, persists it, and returns the whole text.
4. Frontend receives the complete text, adds an assistant message, then calls `POST /api/tts` (see `VoiceService.textToSpeech`).
5. Backend calls ElevenLabs `generate(...)` and returns the audio bytes as a streaming HTTP response.
6. Frontend downloads the entire audio as a Blob (`response.blob()`), then plays it.

Net effect: Users wait for (Claude full response time) + (ElevenLabs synthesis time) + (audio download time) before hearing anything.

---

### Ranked latency culprits and fixes

1) Non‑streaming Claude call blocks TTS start
- Evidence: `backend/main.py` uses `client.messages.create(...)` (non‑streaming). Frontend only triggers TTS after the complete backend response is received.
- Impact: You incur full model latency before any audio can begin.
- Fix (backend): switch to Anthropic streaming and yield deltas. Example:

```python
# backend/main.py (new endpoint)
from fastapi.responses import StreamingResponse
import json

@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    def sse():
        with client.messages.stream(
            model="claude-3-5-sonnet-20241022",
            max_tokens=600,
            system=prompt_manager.get_prompt(task="chat", mode=request.mode or "text"),
            messages=[{"role": "user", "content": request.message}],
        ) as stream:
            for event in stream:
                # Emit only text deltas
                if getattr(event, "type", None) == "content_block_delta":
                    yield f"data: {json.dumps({"delta": event.delta})}\n\n"
            yield "data: {\"done\": true}\n\n"
    return StreamingResponse(sse(), media_type="text/event-stream")
```

- Fix (frontend): consume SSE and incrementally build the assistant message; trigger early TTS (see item 3 for how to stream audio quickly).

2) TTS is consumed as a Blob (non‑streaming playback)
- Evidence: `VoiceService.textToSpeech` does `response.blob()`; playback starts only after the entire file is downloaded.
- Impact: Adds download time (hundreds of ms to seconds) before sound starts.
- Fix (frontend): switch to streaming playback via MediaSource Extensions (MSE) and `response.body`.

```ts
// frontend/src/services/VoiceService.ts (new method)
async streamTtsToAudioElement(text: string, voiceId: string, audioEl: HTMLAudioElement) {
  const res = await fetch(`${this.baseUrl}/api/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice_id: voiceId })
  });
  if (!res.ok || !res.body) throw new Error('TTS stream failed');

  const mediaSource = new MediaSource();
  audioEl.src = URL.createObjectURL(mediaSource);
  await new Promise<void>(resolve => mediaSource.addEventListener('sourceopen', () => resolve(), { once: true }));
  const sb = mediaSource.addSourceBuffer('audio/mpeg');

  const reader = res.body.getReader();
  const pump = async () => {
    const { done, value } = await reader.read();
    if (done) { mediaSource.endOfStream(); return; }
    await new Promise(r => { sb.appendBuffer(value); sb.addEventListener('updateend', r, { once: true }); });
    await pump();
  };
  await pump();
}
```

3) Two sequential round‑trips (chat -> frontend -> tts)
- Evidence: After `/api/chat` finishes, the frontend starts a separate `/api/tts` call.
- Impact: Adds an extra RTT and serializes two expensive steps.
- Fix (backend, v1 quick win): add `/api/voice_chat` that streams audio as soon as the first sentence arrives from Claude. Implementation strategy:
  - Use Anthropic streaming.
  - Buffer text until you detect sentence boundary (e.g., `[.!?]` + space).
  - For each sentence, call ElevenLabs and stream its audio bytes to the client immediately.
  - Use `StreamingResponse` to concatenate chunks; pick `optimize_streaming_latency` in ElevenLabs if available.

```python
# backend/main.py (sketch)
@app.post('/api/voice_chat')
async def voice_chat(request: ChatRequest):
    async def audio_stream():
        buffer = ''
        with client.messages.stream(..., messages=[...]) as stream:
            for ev in stream:
                if ev.type == 'content_block_delta':
                    buffer += ev.delta
                    # Emit sentence when complete
                    while True:
                        m = re.search(r'([\s\S]*?[\.!?])\s+', buffer)
                        if not m: break
                        sentence = m.group(1)
                        buffer = buffer[m.end():]
                        # Synthesize just this sentence and yield bytes
                        audio_bytes = generate(text=sentence, voice=VOICE_ID, model='eleven_multilingual_v2')
                        yield audio_bytes
        if buffer.strip():
            yield generate(text=buffer, voice=VOICE_ID, model='eleven_multilingual_v2')
    return StreamingResponse(audio_stream(), media_type='audio/mpeg')
```

4) Large `conversation_history` payloads from the frontend
- Evidence: `useChat` sends all prior messages every turn; backend also persists conversations and could rebuild state from DB.
- Impact: Larger request payloads and token usage on every turn.
- Fix (protocol): when `conversation_id` is present, stop sending `conversation_history` from the frontend; on the backend, fetch the last K turns from DB and summarize if needed.

```ts
// frontend/src/hooks/useChat.ts (sendMessageToBackend)
const requestBody: ChatRequest = {
  message,
  ...(conversationId && conversationId !== 'new' ? { conversation_id: conversationId } : { start_new: true }),
  ...(mode ? { mode } : {}),
};
```

```python
# backend/main.py (chat): build messages from DB when conversation_id is provided
if request.conversation_id:
    last_turns = (
        db.query(ConversationTurn)
        .filter(ConversationTurn.conversation_id == request.conversation_id)
        .order_by(ConversationTurn.turn_number.desc())
        .limit(10)
        .all()
    )
    for t in reversed(last_turns):
        messages.append({"role": "user", "content": t.user_input})
        messages.append({"role": "assistant", "content": t.ai_response})
messages.append({"role": "user", "content": request.message})
```

5) ElevenLabs synthesis settings
- Evidence: using default `generate(...)` without low‑latency tuning.
- Impact: Adds 200–800ms avoidable latency.
- Fix: if available in your SDK, set low‑latency/streaming options (e.g., `optimize_streaming_latency="4"`, lower bitrate like `mp3_22050_64`) and stream the bytes.

6) Frontend audio gating delay
- Evidence: after speaking ends, recording resumes with a `setTimeout(..., 500)` in `ChatInterface.tsx`.
- Impact: Minor, but adds half a second before recognition resumes.
- Fix: reduce to 150–250ms after verifying no echo, and gate via “isAudioSettling” flag.

---

### Immediate, low‑risk fixes (do these first)

1. Frontend streaming playback for `/api/tts` (replace Blob with `response.body` + MSE). Fast, no backend changes.
2. Reduce payload: stop sending `conversation_history` when `conversation_id` exists; let backend rebuild last K turns.
3. Lower TTS output bitrate (e.g., `mp3_22050_64`) to cut initial bytes while maintaining quality.
4. Decrease the resume delay after TTS from 500ms → 200ms (validate on devices).

### High‑impact structural upgrades (next)

5. Add `/api/chat/stream` (SSE) and update the UI to stream assistant text with incremental display.
6. Add `/api/voice_chat` to stream synthesized audio as sentences arrive from Claude; this collapses two round‑trips into one and starts sound within ~300–700ms of first token.
7. If feasible, use ElevenLabs real‑time streaming APIs for sub‑300ms start times.

### Observability

Add timing logs and client‑side markers to measure:
- t0: user presses send
- t1: first Claude token received
- t2: first audio byte appended to SourceBuffer
- t3: audio `onplay`

Log deltas (t1−t0, t2−t1, t3−t2) to quickly spot regressions.


