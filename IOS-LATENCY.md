## iOS Voice Mode Latency Plan

### Goals
- First audio ≤ 1.0s from Claude first token (stretch ≤ 600ms).
- Start playback immediately on first audio bytes.

### Quick wins
- Reduce TTS bitrate/sample rate (e.g., mp3_22050_64 or PCM 16k mono).
- Use faster voice model path (Claude Haiku 3.5) and concise prompt for voice.
- Reuse a single URLSession and keep audio session active to avoid category flips.

### Streaming playback (Phase 3)
- Implement streaming audio via `AVAudioEngine` + `AVAudioPlayerNode`.
- Consume backend `/api/tts` (streaming) or `/api/voice_chat` for sentence-chunk audio.
- Start playing as soon as first PCM/MP3 frames arrive.

Sketch:
```swift
let engine = AVAudioEngine()
let player = AVAudioPlayerNode()
let format = AVAudioFormat(standardFormatWithSampleRate: 16000, channels: 1)!
engine.attach(player)
engine.connect(player, to: engine.mainMixerNode, format: format)
try engine.start()
player.play()
// On URLSession delegate bytes:
let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames)!
// Fill floatChannelData...
player.scheduleBuffer(buffer, completionHandler: nil)
```

### Optional streaming STT (Phase 4)
- Send partial transcripts to backend to begin Claude earlier.

### Observability
- Correlation ID per turn; log t0 (send), t3 (playback start), t4 (end).


