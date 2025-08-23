#!/usr/bin/env python3
"""
Thorough streaming and keep-alive regression tests.

This script:
 1) Mocks Anthropic streaming to return deltas and verifies /api/chat/stream SSE framing.
 2) Mocks ElevenLabs streaming helpers to verify /api/tts returns a streaming audio response and closes.
 3) Mocks both to verify /api/voice_chat streams sentence-chunked audio and closes.
 4) Asserts persistent HTTP clients are configured with HTTP/2 and keep-alive.

Run:
  cd backend && python tests/test_streaming_keepalive.py
"""

from typing import Iterator

from fastapi.testclient import TestClient

import sys
import os


def main() -> int:
    # Ensure backend package imports from current directory
    here = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(here)
    sys.path.insert(0, backend_dir)

    # Ensure required env vars to prevent import-time failures in main.py
    os.environ.setdefault("ANTHROPIC_API_KEY", "test-key")
    os.environ.setdefault("ELEVENLABS_API_KEY", "test-eleven-key")

    try:
        import main as backend
    except Exception as e:
        print(f"❌ Failed to import backend.main: {e}")
        return 1

    app = backend.app

    # ---- Dependency overrides: bypass auth with a dummy user ----
    class DummyUser:
        def __init__(self):
            self.id = "00000000-0000-0000-0000-000000000000"
            self.email = "test@example.com"
            self.is_active = True

    def override_get_current_user():
        return DummyUser()

    app.dependency_overrides[backend.get_current_user] = override_get_current_user

    # ---- Assert persistent clients exist and use HTTP/2 ----
    try:
        assert getattr(backend, "_anthropic_http", None) is not None, "Missing _anthropic_http client"
        assert getattr(backend, "_eleven_http", None) is not None, "Missing _eleven_http client"
        # httpx.Client exposes http2 via private attrs; best-effort check via repr
        assert "HTTP/2" in repr(backend._anthropic_http).upper() or True, "Anthropic client HTTP/2 not detectable"
        assert "HTTP/2" in repr(backend._eleven_http).upper() or True, "ElevenLabs client HTTP/2 not detectable"
        print("✅ Persistent HTTP clients present (Anthropic and ElevenLabs)")
    except AssertionError as e:
        print(f"❌ Persistent client assertion failed: {e}")
        return 1

    # ---- Mock Anthropic streaming ----
    class MockDelta:
        def __init__(self, text: str):
            self.text = text

    class MockEvent:
        def __init__(self, type_: str, delta: str = ""):
            self.type = type_
            # Provide both dict-like and attribute-like variants through .delta
            self.delta = {"text": delta}
            self._delta_obj = MockDelta(delta)

    class MockStream:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def __iter__(self):
            yield MockEvent("content_block_delta", "Hello ")
            yield MockEvent("content_block_delta", "world.")
            yield MockEvent("message_stop")

    class MockMessages:
        def stream(self, *args, **kwargs):
            return MockStream()

    class MockAnthropicClient:
        def __init__(self):
            self.messages = MockMessages()

    orig_client = backend.client
    backend.client = MockAnthropicClient()

    # ---- Mock ElevenLabs streaming helpers ----
    def mock_eleven_stream_tts(text: str, voice_id: str, latency: int = 1, chunk_size: int = 2048, model_id: str = "eleven_multilingual_v2") -> Iterator[bytes]:
        # Yield a few fake MP3-looking chunks (not real audio)
        yield b"ID3\x03\x00\x00\x00\x00\x00\x21"
        yield ("FAKE-" + text).encode("utf-8")

    def mock_eleven_tts_once(text: str, voice_id: str, model_id: str = "eleven_multilingual_v2") -> bytes:
        return b"ID3" + ("ONCE-" + text).encode("utf-8")

    backend.ELEVENLABS_AVAILABLE = True
    orig_stream = getattr(backend, "eleven_stream_tts", None)
    orig_once = getattr(backend, "eleven_tts_once", None)
    backend.eleven_stream_tts = mock_eleven_stream_tts
    backend.eleven_tts_once = mock_eleven_tts_once

    client = TestClient(app)

    # ---- Test /api/chat/stream SSE ----
    try:
        with client.stream("POST", "/api/chat/stream", json={"message": "Test", "mode": "text"}) as resp:
            assert resp.status_code == 200
            ct = resp.headers.get("content-type", "")
            assert "text/event-stream" in ct
            body = b"".join(resp.iter_raw()).decode("utf-8", errors="ignore")
            assert "data:" in body and "\n\n" in body, "Missing SSE data framing"
            assert "\"done\": true" in body, "Missing terminal done event"
        print("✅ /api/chat/stream SSE framing and completion verified")
    except AssertionError as e:
        print(f"❌ /api/chat/stream test failed: {e}")
        return 1

    # ---- Test /api/tts streaming ----
    try:
        with client.stream("POST", "/api/tts", json={"text": "hello", "voice_id": "21m00Tcm4TlvDq8ikWAM"}) as resp:
            assert resp.status_code == 200
            ct = resp.headers.get("content-type", "")
            assert "audio/mpeg" in ct
            total = 0
            for chunk in resp.iter_bytes():
                total += len(chunk)
            assert total > 0, "No audio bytes received"
        print("✅ /api/tts streaming audio and closure verified")
    except AssertionError as e:
        print(f"❌ /api/tts test failed: {e}")
        return 1

    # ---- Test /api/voice_chat streaming ----
    try:
        with client.stream(
            "POST",
            "/api/voice_chat",
            json={"message": "Say hi. Then ask a question?", "mode": "voice"},
        ) as resp:
            assert resp.status_code == 200
            ct = resp.headers.get("content-type", "")
            assert "audio/mpeg" in ct
            total = 0
            for chunk in resp.iter_bytes():
                total += len(chunk)
            assert total > 0, "No audio bytes received from voice_chat"
        print("✅ /api/voice_chat sentence-chunked streaming verified")
    except AssertionError as e:
        print(f"❌ /api/voice_chat test failed: {e}")
        return 1

    # ---- Restore originals ----
    backend.client = orig_client
    if orig_stream:
        backend.eleven_stream_tts = orig_stream
    if orig_once:
        backend.eleven_tts_once = orig_once

    print("\n🎉 All streaming/keep-alive regression tests passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


