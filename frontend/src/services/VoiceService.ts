export interface Voice {
  id: string;
  name: string;
  description: string;
  category: string;
}

export interface VoicesResponse {
  voices: Voice[];
}

export class VoiceService {
  private baseUrl: string;
  
  constructor() {
    this.baseUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
  }

  /**
   * Stream a full voice chat turn (Claude -> ElevenLabs -> audio) into the provided audio element.
   * This hits the backend /api/voice_chat endpoint which streams audio/mpeg bytes continuously.
   */
  async streamVoiceChatToAudioElement(
    message: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    audioEl: HTMLAudioElement,
    abortSignal?: AbortSignal,
    conversationId?: string,
    voiceId?: string,
    startNew?: boolean,
  ): Promise<string | undefined> {
    const ttsDebug = process.env.REACT_APP_TTS_TIMING_DEBUG === 'true';
    const t0 = Date.now();
    const accessToken = localStorage.getItem('access_token');
    const includeConversationId = conversationId && conversationId !== 'new';
    const body = {
      message,
      conversation_history: conversationHistory,
      ...(includeConversationId ? { conversation_id: conversationId } : {}),
      ...(startNew ? { start_new: true } : {}),
      mode: 'voice',
    };
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    };
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    const url = new URL(`${this.baseUrl}/api/voice_chat`);
    if (voiceId) url.searchParams.set('voice_id', voiceId);
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(body),
      signal: abortSignal,
    });
    if (!response.ok) {
      throw new Error(`voice_chat stream failed: ${response.status} ${response.statusText}`);
    }
    if (!response.body) throw new Error('voice_chat stream failed: missing response body');

    if (typeof window === 'undefined' || !('MediaSource' in window)) {
      throw new Error('MediaSource not supported');
    }

    const mediaSource = new MediaSource();
    const objectUrl = URL.createObjectURL(mediaSource);
    audioEl.src = objectUrl;
    const once = <K extends keyof MediaSourceEventMap>(target: MediaSource, event: K) => new Promise<void>((resolve) => target.addEventListener(event, () => resolve(), { once: true }));
    await once(mediaSource, 'sourceopen');
    if (ttsDebug) {
      // eslint-disable-next-line no-console
      console.log('[VC-MS] media source open', { dt: Date.now() - t0 });
    }
    const mime = 'audio/mpeg';
    const sourceBuffer = mediaSource.addSourceBuffer(mime);
    const reader = response.body.getReader();
    let firstAppendDone = false;
    let firstAppendTs: number | null = null;
    const appendChunk = (chunk: Uint8Array) => new Promise<void>((resolve, reject) => {
      const onError = () => { cleanup(); reject(new Error('SourceBuffer error')); };
      const onUpdateEnd = () => { cleanup(); resolve(); };
      const cleanup = () => {
        sourceBuffer.removeEventListener('error', onError);
        sourceBuffer.removeEventListener('updateend', onUpdateEnd);
      };
      sourceBuffer.addEventListener('error', onError);
      sourceBuffer.addEventListener('updateend', onUpdateEnd);
      sourceBuffer.appendBuffer(chunk);
    });
    const headerConversationId = response.headers.get('X-Conversation-Id') || undefined;
    try {
      // Pump the response stream
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          try { mediaSource.endOfStream(); } catch (_) {}
          break;
        }
        if (value && value.byteLength > 0) {
          await appendChunk(value);
          if (!firstAppendDone) {
            firstAppendDone = true;
            firstAppendTs = Date.now();
            if (ttsDebug) {
              // eslint-disable-next-line no-console
              console.log('[VC-MS] first-append', { dt: firstAppendTs - t0, size: value.byteLength });
            }
            try { void audioEl.play(); } catch (_) {}
          }
        }
      }
    } catch (err) {
      try { mediaSource.endOfStream(); } catch (_) {}
      URL.revokeObjectURL(objectUrl);
      throw err;
    }
    // Cleanup object URL when playback ends
    const revokeOnEnd = () => { URL.revokeObjectURL(objectUrl); audioEl.removeEventListener('ended', revokeOnEnd); };
    audioEl.addEventListener('ended', revokeOnEnd, { once: true });
    if (ttsDebug) {
      // eslint-disable-next-line no-console
      console.log('[VC-MS] end-of-stream', { totalMs: Date.now() - t0 });
    }
    return headerConversationId;
  }
  
  /**
   * Convert text to speech using ElevenLabs
   */
  async textToSpeech(text: string, voiceId: string): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice_id: voiceId })
    });
    
    if (!response.ok) {
      throw new Error(`TTS request failed: ${response.status} ${response.statusText}`);
    }
    
    return response.blob();
  }

  /**
   * Stream TTS audio bytes into a provided HTMLAudioElement using MSE.
   * Plays as soon as first bytes are appended to the SourceBuffer.
   */
  async streamTtsToAudioElement(text: string, voiceId: string, audioEl: HTMLAudioElement, abortSignal?: AbortSignal): Promise<void> {
    const ttsDebug = process.env.REACT_APP_TTS_TIMING_DEBUG === 'true';
    const t0 = Date.now();
    const response = await fetch(`${this.baseUrl}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
      body: JSON.stringify({ text, voice_id: voiceId }),
      signal: abortSignal,
    });

    if (!response.ok) {
      throw new Error(`TTS stream failed: ${response.status} ${response.statusText}`);
    }
    if (!response.body) {
      throw new Error('TTS stream failed: missing response body');
    }

    // Basic feature detection for MSE
    if (typeof window === 'undefined' || !('MediaSource' in window)) {
      throw new Error('MediaSource not supported');
    }

    const mediaSource = new MediaSource();
    const objectUrl = URL.createObjectURL(mediaSource);
    audioEl.src = objectUrl;

    // Utility: await one-time event
    const once = <K extends keyof MediaSourceEventMap>(target: MediaSource, event: K) => new Promise<void>((resolve) => target.addEventListener(event, () => resolve(), { once: true }));
    await once(mediaSource, 'sourceopen');
    if (ttsDebug) {
      // eslint-disable-next-line no-console
      console.log('[TTS-MS] media source open', { dt: Date.now() - t0 });
    }

    const mime = 'audio/mpeg';
    const sourceBuffer = mediaSource.addSourceBuffer(mime);

    const reader = response.body.getReader();
    let firstAppendDone = false;
    let firstAppendTs: number | null = null;
    let appendLogCount = 0;

    const appendChunk = (chunk: Uint8Array) => new Promise<void>((resolve, reject) => {
      const onError = () => { cleanup(); reject(new Error('SourceBuffer error')); };
      const onUpdateEnd = () => { cleanup(); resolve(); };
      const cleanup = () => {
        sourceBuffer.removeEventListener('error', onError);
        sourceBuffer.removeEventListener('updateend', onUpdateEnd);
      };
      sourceBuffer.addEventListener('error', onError);
      sourceBuffer.addEventListener('updateend', onUpdateEnd);
      sourceBuffer.appendBuffer(chunk);
    });

    try {
      // Pump the response stream
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          try {
            mediaSource.endOfStream();
          } catch (_) {}
          break;
        }
        if (value && value.byteLength > 0) {
          await appendChunk(value);
          if (!firstAppendDone) {
            firstAppendDone = true;
            firstAppendTs = Date.now();
            if (ttsDebug) {
              // eslint-disable-next-line no-console
              console.log('[TTS-MS] first-append', { dt: firstAppendTs - t0, size: value.byteLength });
            }
            try {
              if (audioEl.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
                // Start immediately if we already have enough data
                // Ignore play() promise rejections due to autoplay policy
                // (user action should have preceded this in most flows)
                void audioEl.play();
              } else {
                // Attempt to play regardless; subsequent appends will fill buffer
                void audioEl.play();
              }
            } catch (_) {
              // Non-fatal; user gesture may be required
            }
          }
          if (ttsDebug) {
            appendLogCount += 1;
            if (appendLogCount % 16 === 0 || value.byteLength >= 8192) {
              // eslint-disable-next-line no-console
              console.log('[TTS-MS] append', { size: value.byteLength, ttfp: firstAppendTs ? Date.now() - firstAppendTs : undefined });
            }
          }
        }
      }
    } catch (err) {
      try { mediaSource.endOfStream(); } catch (_) {}
      URL.revokeObjectURL(objectUrl);
      throw err;
    }

    // Cleanup: allow GC of MediaSource URL after playback ends
    const revokeOnEnd = () => { URL.revokeObjectURL(objectUrl); audioEl.removeEventListener('ended', revokeOnEnd); };
    audioEl.addEventListener('ended', revokeOnEnd, { once: true });
    if (ttsDebug) {
      // eslint-disable-next-line no-console
      console.log('[TTS-MS] end-of-stream', { totalMs: Date.now() - t0 });
    }
  }
  
  /**
   * Get list of available voices
   */
  async getAvailableVoices(): Promise<Voice[]> {
    const response = await fetch(`${this.baseUrl}/api/voices`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch voices: ${response.status} ${response.statusText}`);
    }
    
    const data: VoicesResponse = await response.json();
    return data.voices;
  }
  
  /**
   * Get default voice ID
   */
  getDefaultVoiceId(): string {
    return process.env.REACT_APP_DEFAULT_VOICE_ID || 'ErXwobaYiN019PkySvjV';
  }
  
  /**
   * Check if ElevenLabs is enabled
   */
  isElevenLabsEnabled(): boolean {
    return process.env.REACT_APP_ELEVENLABS_ENABLED === 'true';
  }
}
