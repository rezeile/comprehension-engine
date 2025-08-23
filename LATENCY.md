## Voice Mode Latency – Index

The latency plan is split into focused documents for each layer:

- iOS: `IOS-LATENCY.md`
- Web: `WEB-LATENCY.md`
- Backend: `BACKEND-LATENCY.md`

Shared goals across all layers:
- First audio ≤ 1.0s from Claude first token (stretch ≤ 600ms)
- Start playback as soon as audio bytes arrive (streaming everywhere)

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

Implementation notes (server):
- Prefer ElevenLabs low-latency options (optimize_streaming_latency, lower sample rate/bitrate). For sentence-level streaming, issue parallel synthesis per sentence and yield in order.
- Keep one Anthropic and one ElevenLabs client per process to reuse HTTP/2 connections.

Implementation notes (iOS):
- Add a `GET /api/voice_chat` streaming endpoint client. Use `URLSession` with a `Bytes`/delegate to read bytes and feed them into `AVAudioEngine` + `AVAudioPlayerNode` as PCM frames. Begin playback on first buffer.
- Alternatively, if backend streams MP3, decode frames incrementally; PCM is simpler for live streaming.

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

<!-- 6) Streaming STT (optional but synergistic)
- Motivation: Start Claude generation before user completely finishes speaking by sending partial transcripts. This overlaps user speech, model thinking, and TTS.
- Plan:
  - Web: stream partial STT to backend via WebSocket/SSE (`/api/stt/ingest`) with a conversation turn ID; backend accumulates and can begin Claude streaming when confidence crosses threshold.
  - iOS: we already have on-device partials; optionally POST/SSE partials to backend similarly to start Claude earlier. Gate by VAD / punctuation to avoid premature prompts. -->

---

### Phased implementation plan

Phase 0 – Observability hardening (today)
- Keep the iOS timestamps you added and add correlation IDs per turn (uuid in request header) propagated to backend logs.
- Backend: log t0 (HTTP start), t1 (first Claude token), t2 (first audio bytes to client), t3 (stream end). Emit deltas.

Phase 1 – Quick wins (tomorrow)
- Lower TTS output size: switch to a smaller audio format (e.g., `mp3_22050_64` or similar) to reduce bytes and time-to-first-byte.
- Reduce voice-mode response length: lower max tokens and add “be concise for voice” instruction.
- Use a faster model for voice (Claude Haiku 3.5) while keeping Sonnet for typed mode.
- Backend: reuse persistent clients; avoid Cloudflare tunnel for latency tests; co-locate backend near client.

Phase 2 – Claude streaming (SSE)
- Backend: add `/api/chat/stream` using Anthropic streaming, emitting only text deltas.
- Client (web): consume SSE and build message incrementally; start early TTS (Phase 3) on first complete sentence.
- Client (iOS): either keep current path or call a new combined `/api/voice_chat` in Phase 3.

Phase 3 – TTS streaming and early playback
- Backend v1: keep `/api/tts` but switch to streaming response; clients stream-play (web via MSE; iOS via `AVAudioEngine`).
- Backend v2 (preferred): implement `/api/voice_chat` that:
  - Streams Claude deltas.
  - Detects sentence boundaries; for each sentence, synthesizes with ElevenLabs and streams audio bytes immediately.
  - Uses `optimize_streaming_latency` and a lower audio bitrate.
- Client (iOS): implement an audio streaming player:

```swift
// Sketch: streaming PCM playback
let engine = AVAudioEngine()
let player = AVAudioPlayerNode()
let format = AVAudioFormat(standardFormatWithSampleRate: 16000, channels: 1)!
engine.attach(player)
engine.connect(player, to: engine.mainMixerNode, format: format)
try engine.start()
player.play()

// As bytes arrive from URLSession delegate:
let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames)!
// Fill buffer.floatChannelData… then
player.scheduleBuffer(buffer, completionHandler: nil)
```

<!-- Phase 4 – Streaming STT (optional)
- Web/iOS: send partial transcripts to backend; backend begins Claude streaming when partials stabilize, further reducing t0→first token. -->

---

### Configuration knobs to apply
- ElevenLabs
  - optimize_streaming_latency = highest acceptable setting
  - audio format: mono, 16 kHz, lower bitrate (e.g., `mp3_22050_64`) or raw PCM for lowest start time
- Claude
  - Use Haiku 3.5 for voice mode
  - Lower max_tokens for voice; ensure “concise spoken style” prompt
- Networking
  - Persistent HTTP/2 clients
  - Avoid tunnels in production
  - Co-locate compute with client region

---

### Validation & SLOs
- Log the following per turn with a correlation ID:
  - t0: send
  - t1: first Claude token (server side)
  - t2: first audio byte to client
  - t3: audio playback start (client)
  - t4: audio playback end (client)
- Success if:
  - t1−t0 ≤ 700ms on p50; ≤ 1.2s p95
  - t2−t1 ≤ 400ms on p50; ≤ 800ms p95
  - t3−t2 ≤ 150ms on p50; ≤ 300ms p95

---

### Task breakdown (for implementation tomorrow)
1) Backend
   - [x] Add `/api/chat/stream` (SSE) with Anthropic streaming
   - [x] Add `/api/tts` streaming response (chunked audio)
   - [x] Add `/api/voice_chat` streaming audio composed from sentence-chunk TTS
   - [x] Configure ElevenLabs low-latency settings; pick smaller audio format
   - [x] Reuse HTTP clients; ensure keep-alive
2) Web frontend
   - [ ] Replace Blob TTS with MSE streaming
   - [ ] Consume SSE from `/api/chat/stream`; start early TTS on sentence boundaries
3) iOS client
   - [ ] Implement streaming audio playback with `AVAudioEngine` + `AVAudioPlayerNode`
   - [ ] Add support for `/api/voice_chat` to get audio directly
   - [ ] Add concise voice prompt + lower max tokens for voice path
4) Observability
   - [ ] Add correlation IDs and emit t0..t4 across services
   - [ ] Dashboards for p50/p95 per stage

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


