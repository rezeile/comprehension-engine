## Backend Latency Plan (Claude + TTS)

### Goals
- First Claude token ≤ 300–700ms (SSE streaming).
- First audio byte to client ≤ 300–700ms after first sentence.

### Endpoints
- `/api/chat/stream` (SSE): stream Anthropic deltas (text only).
- `/api/tts` (streaming): return chunked audio; favor low-latency format.
- `/api/voice_chat` (preferred): stream sentence-chunk TTS as Claude deltas arrive.

### Implementation notes
- Anthropic: use streaming client; emit only `content_block_delta` text.
- ElevenLabs: enable low-latency options (optimize_streaming_latency), pick lower bitrate/sample rate; reuse client.
- Sentence segmentation: simple regex `[.!?] +` or token-pause heuristic; flush final buffer.
- Keep-alive: reuse HTTP/2 clients and connections.
- Region: co-locate with client to avoid extra RTT; avoid tunnels in prod.

### Observability
- Correlation ID per turn; log:
  - t0: HTTP start for chat
  - t1: first Claude token emitted
  - t2: first audio bytes written to response
  - t_end: stream complete

### Migration path
1) Add `/api/chat/stream`.
2) Make `/api/tts` streaming.
3) Add `/api/voice_chat` and migrate clients.
4) Reduce history payload by reconstructing last K turns from DB when `conversation_id` provided.



