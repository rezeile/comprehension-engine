## TTS timing issues and stabilization plan

Context: During voice mode, the assistant sometimes interrupts itself or starts speaking a later sentence before the earlier one has finished. Example behavior: the first word (e.g., "Ah") plays, then playback jumps ahead to a later sentence. We also want full Claude response logging to debug.

### Likely root causes
- Competing TTS triggers:
  - We stream sentence-by-sentence via `/api/chat/stream` and `onStreamSentence(...)` while a separate auto-speak effect may also fire when the assistant message updates, causing a competing TTS of the whole reply.
- No sentence-level queue:
  - Each sentence call to ElevenLabs starts a fresh stream that replaces the `audio.src` on the same `HTMLAudioElement`, which can preempt/interrupt the prior sentence if not sequenced.
- Early/late state transitions:
  - `isSpeaking` transitions may lag or clear early, allowing an overlapping start.
- Sentence detection edge cases:
  - Regex splitting can emit multiple boundaries in a single chunk; without a queue, multiple TTS starts compete.

### Goals
1) Single source of truth for TTS triggering (no duplicate initiators).
2) Strict FIFO sequencing of sentences (no preemption inside a single assistant turn).
3) Deterministic stop/flush behavior between turns (user interruption cancels; new assistant turn clears queue).
4) High-quality diagnostics: full Claude text, per-sentence enqueue/dequeue timestamps, playback start/end.

### Implementation plan (no code changes yet)

1) Centralize triggering and disable duplicate paths
- Add a streaming-session guard in `useChat`:
  - Expose `onStreamStart()` and `onStreamDone()` callbacks (in addition to `onStreamSentence`).
  - While streaming is active, disable ChatInterface’s auto-speak effect (which currently voices the final full message). Only `onStreamSentence` drives TTS in voice mode.
- At SSE completion, flush any remaining text via `onStreamSentence` exactly once; then mark streaming done.

2) Introduce a sentence-level FIFO queue in `useVoiceSynthesis`
- Add a lightweight `TtsQueue` inside `useVoiceSynthesis`:
  - `enqueue({ text, voiceId, preferStreaming })` appends a task.
  - A single worker runs tasks serially; next begins only after the previous `ended` (or error/abort) fires.
  - `stop()` clears the queue and aborts the active task.
  - When a new assistant turn begins, `resetQueue()` is called to cancel and clear any remaining items.
- The queue calls existing implementations:
  - Prefer `streamTtsToAudioElement(...)` for each sentence; fall back to blob/web speech if streaming fails.
  - The queue owns the `HTMLAudioElement`; it must not replace `src` while playing—only after `ended`.

3) Deterministic ownership of the audio element
- Create or reuse a single `audioEl` that is owned by the `TtsQueue`.
- Only the active queue task may set `audio.src`/MediaSource; the next task waits for `ended`.
- If the user interrupts (stop/exit voice mode), abort the active controller and clear queue.

4) Robust sentence segmentation
- Keep a rolling buffer; extract sentences with a conservative regex (`/([\s\S]*?[.!?])\s+/g`).
- For each match, emit exactly one `onStreamSentence(sentence)` in order.
- Maintain the remainder buffer precisely (no `lastIndex` truncation that can cut text). Track processed length using the regex’s lastIndex and slice the string accordingly.

5) Logging and diagnostics (toggle by env `REACT_APP_TTS_TIMING_DEBUG=true`)
- In `useChat.sendMessageStreamed`:
  - Log a console group for the turn with timestamps.
  - Log each SSE delta length, each emitted sentence (with index), and the final full Claude response.
- In `useVoiceSynthesis` (TtsQueue):
  - Log `enqueue` (idx, chars), `dequeue-start`, `network-start`, `first-byte`, `audio-play`, `audio-ended`, `aborted`.
  - Log queue length before/after each operation.
- In `VoiceService.streamTtsToAudioElement`:
  - Log when MediaSource opens, each append size, first append time-to-play (TTFP), and end-of-stream.

6) Interaction with STT (speech recognition)
- Maintain the current behavior of pausing STT at TTS start and resuming shortly after TTS end.
- When a new assistant turn begins, ensure STT is paused before queuing the first sentence.

7) Turn lifecycle and cancellation
- On new user message: `resetQueue()` (cancel active), clear any residual audio, then start the next streaming session.
- On exit voice mode: `stop()` (cancel active and clear queue) and do not auto-resume STT until the user re-enters voice mode.

### Acceptance tests
- Voice mode, two consecutive prompts:
  - Sentences play in order without preemption.
  - No duplicate speaking of the entire message after sentence streaming.
  - STT resumes only after TTS completion and does not capture the assistant’s voice.
- Long reply with many sentence boundaries:
  - Queue length increases and drains FIFO; timing logs show sequential playback.
- Interruption tests:
  - While sentence 2 is playing, send a new prompt → queue resets; sentence 2 stops promptly; new turn begins.
- Error path:
  - Simulate streaming failure for a sentence → fallback to blob or skip with logged error; queue continues to next sentence.

### Next steps
- Implement the instrumentation and the `TtsQueue` in `useVoiceSynthesis`.
- Wire `onStreamStart/onStreamDone` in `useChat` and gate ChatInterface auto-speak while streaming is active.
- Verify with logs that each sentence is enqueued/played once, in order, with no src preemption.


