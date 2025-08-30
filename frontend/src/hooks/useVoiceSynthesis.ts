import { useState, useRef, useCallback, useEffect } from 'react';
import { VoiceSynthesisState, VoiceSynthesisOptions } from '../types/voice.types';
import { VoiceService } from '../services/VoiceService';

export const useVoiceSynthesis = (options: VoiceSynthesisOptions = {}) => {
  const {
    voice,
    rate = 0.9,
    pitch = 1.0,
    volume = 1.0,
    onStart,
    onEnd,
    onError
  } = options;

  // State management
  const [state, setState] = useState<VoiceSynthesisState>({
    isSpeaking: false,
    currentText: null,
    error: null
  });

  // Refs for tracking synthesis state
  const synthesisRef = useRef<SpeechSynthesis | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  // Single audio element owned by the TTS queue
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const streamingAbortRef = useRef<AbortController | null>(null);
  const ttsInFlightRef = useRef<boolean>(false);
  const currentObjectUrlRef = useRef<string | null>(null);
  const shouldFireOnStartOnPlayRef = useRef<boolean>(false);
  const debugTiming = process.env.REACT_APP_TTS_TIMING_DEBUG === 'true';
  const isSpeakingRef = useRef<boolean>(false);
  const taskSeqRef = useRef<number>(0);
  const lastCompletedNormalizedRef = useRef<string>('');
  const normalizeText = useCallback((t: string) => t.replace(/\s+/g, ' ').trim(), []);

  // Simple FIFO queue for sentence-level TTS
  type TtsTask = { text: string; voiceId?: string; useElevenLabs: boolean; preferStreaming: boolean };
  const ttsQueueRef = useRef<TtsTask[]>([]);
  const isProcessingQueueRef = useRef<boolean>(false);
  const processNextRef = useRef<() => void>(() => {});

  // Voice service for ElevenLabs integration
  const voiceServiceRef = useRef<VoiceService | null>(null);
  // Prefetch state (single-item lookahead)
  const prefetchAbortRef = useRef<AbortController | null>(null);
  const prefetchedUrlRef = useRef<string | null>(null);
  const prefetchedTextRef = useRef<string | null>(null);
  const prefetchedVoiceRef = useRef<string | null>(null);

  // Check browser compatibility
  const isSpeechSynthesisSupported = 'speechSynthesis' in window;

  // Initialize speech synthesis
  useEffect(() => {
    if (isSpeechSynthesisSupported) {
      synthesisRef.current = window.speechSynthesis;
      
      // Get available voices and set a good one
      const setVoice = () => {
        const voices = synthesisRef.current?.getVoices() || [];
        const preferredVoice = voices.find(voice => 
          voice.lang.startsWith('en') && 
          (voice.name.includes('Google') || voice.name.includes('Natural') || voice.name.includes('Premium'))
        ) || voices.find(voice => voice.lang.startsWith('en')) || voices[0];
        
        if (preferredVoice && !voice) {
          // Set default voice if none specified
          // Note: We can't modify options.voice directly, so we'll use the preferred voice
          // in the speakWithWebSpeech function instead
        }
      };

      // Chrome loads voices asynchronously
      if (synthesisRef.current.onvoiceschanged !== undefined) {
        synthesisRef.current.onvoiceschanged = setVoice;
      } else {
        setVoice();
      }
    }

    // Initialize voice service
    voiceServiceRef.current = new VoiceService();

    return () => {
      if (currentUtteranceRef.current) {
        synthesisRef.current?.cancel();
      }
    };
  }, [isSpeechSynthesisSupported, voice]);

  // Web Speech API synthesis
  const speakWithWebSpeech = useCallback((text: string) => {
    if (!isSpeechSynthesisSupported) {
      setState(prev => ({ ...prev, error: 'Speech synthesis not supported' }));
      return false;
    }

    // Prevent multiple simultaneous speech instances
    if (state.isSpeaking) {
      return false;
    }

    // Stop any current speech
    synthesisRef.current?.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;
    
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => {
      setState(prev => ({ 
        ...prev, 
        isSpeaking: true, 
        currentText: text,
        error: null
      }));
      onStart?.();
    };

    utterance.onend = () => {
      setState(prev => ({ 
        ...prev, 
        isSpeaking: false,
        currentText: null
      }));
      onEnd?.();
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      setState(prev => ({ 
        ...prev, 
        isSpeaking: false,
        currentText: null,
        error: 'Speech synthesis failed'
      }));
      onError?.(event as any);
    };

    currentUtteranceRef.current = utterance;
    
    try {
      synthesisRef.current?.speak(utterance);
      return true;
    } catch (error) {
      console.error('Error starting speech synthesis:', error);
      setState(prev => ({ 
        ...prev, 
        isSpeaking: false,
        error: 'Failed to start speech synthesis'
      }));
      return false;
    }
  }, [isSpeechSynthesisSupported, state.isSpeaking, rate, pitch, volume, voice, onStart, onEnd, onError]);

  // Ensure single audio element exists and wire core listeners
  const ensureAudioEl = useCallback(() => {
    if (!audioElRef.current) {
      const el = new Audio();
      el.preload = 'auto';
      el.addEventListener('play', () => {
        setState(prev => ({ ...prev, isSpeaking: true }));
        isSpeakingRef.current = true;
        if (shouldFireOnStartOnPlayRef.current) {
          shouldFireOnStartOnPlayRef.current = false;
          onStart?.();
        }
      });
      el.addEventListener('ended', () => {
        setState(prev => ({ ...prev, isSpeaking: false, currentText: null }));
        isSpeakingRef.current = false;
        try {
          const t = (el as any)._ttsText as string | undefined;
          if (typeof t === 'string' && t.length > 0) {
            lastCompletedNormalizedRef.current = normalizeText(t);
          }
          (el as any)._ttsText = undefined;
        } catch {}
        if (currentObjectUrlRef.current) {
          try { URL.revokeObjectURL(currentObjectUrlRef.current); } catch {}
          currentObjectUrlRef.current = null;
        }
        streamingAbortRef.current = null;
        onEnd?.();
        Promise.resolve().then(() => processNextRef.current());
      });
      el.addEventListener('error', () => {
        setState(prev => ({ ...prev, isSpeaking: false, currentText: null, error: 'Audio playback failed' }));
        isSpeakingRef.current = false;
        if (currentObjectUrlRef.current) {
          try { URL.revokeObjectURL(currentObjectUrlRef.current); } catch {}
          currentObjectUrlRef.current = null;
        }
        onError?.({ error: 'audio-playback-failed', message: 'Audio playback failed' } as any);
        Promise.resolve().then(() => processNextRef.current());
      });
      audioElRef.current = el;
    }
    return audioElRef.current!;
  }, [onStart, onEnd, onError, normalizeText]);

  // ElevenLabs TTS synthesis (Blob fallback)
  const speakWithElevenLabs = useCallback(async (text: string, selectedVoiceId: string) => {
    // Prevent multiple simultaneous speech instances
    if (state.isSpeaking) {
      return false;
    }

    // Coalesce concurrent requests (e.g., StrictMode double effects)
    if (ttsInFlightRef.current) {
      return false;
    }
    ttsInFlightRef.current = true;

    // Check if ElevenLabs is enabled
    if (!voiceServiceRef.current?.isElevenLabsEnabled()) {
      setState(prev => ({ ...prev, error: 'ElevenLabs not enabled' }));
      return false;
    }

    try {
      // Stop Web Speech API if it's running
      if (synthesisRef.current) {
        synthesisRef.current.cancel();
      }
      
      const t3_requestStart = Date.now();
      const audioBlob = await voiceServiceRef.current.textToSpeech(text, selectedVoiceId);
      const t3_requestEnd = Date.now();
      console.log('[VM] tts blob received', { ts: t3_requestEnd, fetchMs: t3_requestEnd - t3_requestStart, size: audioBlob.size });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = ensureAudioEl();
      // Clear in-flight when playback starts (handled by 'play' listener)
      ttsInFlightRef.current = false;
      // Mark to fire onStart from 'play'
      shouldFireOnStartOnPlayRef.current = true;
      // Update text for UI state
      setState(prev => ({ ...prev, currentText: text, error: null }));
      try { (audio as any)._ttsText = text; } catch {}
      // Cleanup any previous blob URL
      if (currentObjectUrlRef.current) {
        try { URL.revokeObjectURL(currentObjectUrlRef.current); } catch {}
      }
      currentObjectUrlRef.current = audioUrl;
      audio.src = audioUrl;
      try {
        await audio.play();
        return true;
      } catch (playError) {
        console.error('Error playing ElevenLabs audio:', playError);
        setState(prev => ({ 
          ...prev, 
          isSpeaking: false,
          error: 'Failed to play audio'
        }));
        ttsInFlightRef.current = false;
        // Fallback to Web Speech API
        return speakWithWebSpeech(text);
      }
      
    } catch (error) {
      console.error('ElevenLabs TTS failed, falling back to Web Speech API:', error);
      setState(prev => ({ ...prev, error: 'ElevenLabs TTS failed' }));
      ttsInFlightRef.current = false;
      // Fallback to Web Speech API
      return speakWithWebSpeech(text);
    }
  }, [state.isSpeaking, speakWithWebSpeech, ensureAudioEl]);

  // ElevenLabs TTS synthesis (MSE streaming)
  const speakWithElevenLabsStreaming = useCallback(async (text: string, selectedVoiceId: string) => {
    // Prevent overlap with an existing network stream only; the queue already guards isSpeaking
    if (streamingAbortRef.current) return false;
    if (!voiceServiceRef.current?.isElevenLabsEnabled()) {
      setState(prev => ({ ...prev, error: 'ElevenLabs not enabled' }));
      return false;
    }

    try {
      // Cancel Web Speech API if active
      if (synthesisRef.current) synthesisRef.current.cancel();

      // Prepare a persistent audio element for streaming (single shared element)
      const audio = ensureAudioEl();

      const controller = new AbortController();
      streamingAbortRef.current = controller;

      // Signal speaking immediately to pause STT and UI state
      setState(prev => ({ ...prev, isSpeaking: true, currentText: text, error: null }));
      onStart?.();
      try { (audio as any)._ttsText = text; } catch {}

      const tStart = Date.now();
      if (debugTiming) {
        // eslint-disable-next-line no-console
        console.log('[TTSQ] calling /api/tts (stream)', { chars: text.length, ts: tStart });
      }
      try {
        await voiceServiceRef.current!.streamTtsToAudioElement(text, selectedVoiceId, audio, controller.signal);
      } finally {
        // Clear the in-flight latch so subsequent requests can start
        if (streamingAbortRef.current === controller) {
          streamingAbortRef.current = null;
        }
      }
      const tEnd = Date.now();
      // Optional diagnostics
      // eslint-disable-next-line no-console
      console.log('[VM] TTS streaming completed', { ms: tEnd - tStart });
      return true;
    } catch (err) {
      // Fallback to Blob/Web Speech on error
      streamingAbortRef.current = null;
      setState(prev => ({ ...prev, isSpeaking: false }));
      try {
        const ok = await speakWithElevenLabs(text, selectedVoiceId);
        Promise.resolve().then(() => processNextRef.current());
        return ok;
      } catch {
        const ok = speakWithWebSpeech(text);
        Promise.resolve().then(() => processNextRef.current());
        return ok;
      }
    }
  }, [speakWithElevenLabs, speakWithWebSpeech, ensureAudioEl, debugTiming, onStart]);

  // Main speak function
  // Queue processing helpers
  const maybeStartNextFromQueue = useCallback(() => {
    if (isProcessingQueueRef.current) return;
    if (isSpeakingRef.current) return;
    const next = ttsQueueRef.current.shift();
    if (!next) return;
    isProcessingQueueRef.current = true;
    const run = async () => {
      try {
        if (next.useElevenLabs && next.voiceId) {
          // If we have a prefetched match, play it instantly
          const normalized = next.text.replace(/\s+/g, ' ').trim();
          const hasPrefetch = prefetchedUrlRef.current && prefetchedTextRef.current === normalized && prefetchedVoiceRef.current === next.voiceId;
          if (hasPrefetch) {
            const audio = ensureAudioEl();
            try { (audio as any)._ttsText = next.text; } catch {}
            audio.src = prefetchedUrlRef.current!;
            // Consume the prefetch so it won't be reused
            prefetchedUrlRef.current = null;
            prefetchedTextRef.current = null;
            prefetchedVoiceRef.current = null;
            await audio.play().catch(() => {});
            return;
          }
          if (next.preferStreaming) {
            const ok = await speakWithElevenLabsStreaming(next.text, next.voiceId);
            if (ok) return;
          }
          await speakWithElevenLabs(next.text, next.voiceId);
        } else {
          speakWithWebSpeech(next.text);
        }
      } finally {
        isProcessingQueueRef.current = false;
        // If speaking ended synchronously (Web Speech may), ensure we continue
        if (!isSpeakingRef.current) {
          maybeStartNextFromQueue();
        }
      }
    };
    run();
  }, [speakWithElevenLabsStreaming, speakWithElevenLabs, speakWithWebSpeech, ensureAudioEl]);

  useEffect(() => {
    processNextRef.current = maybeStartNextFromQueue;
  }, [maybeStartNextFromQueue]);

  const enqueue = useCallback((task: TtsTask) => {
    // Simple dedupe: drop if identical to the last completed utterance
    const norm = normalizeText(task.text);
    if (norm && norm === lastCompletedNormalizedRef.current) {
      if (debugTiming) {
        // eslint-disable-next-line no-console
        console.log('[TTSQ] drop-duplicate', { chars: task.text.length, ts: Date.now() });
      }
      return false;
    }
    const id = taskSeqRef.current++;
    (task as any).id = id;
    const before = ttsQueueRef.current.length;
    ttsQueueRef.current.push(task);
    // One-item lookahead prefetch: if this is the only queued item after push, prefetch the next if any
    // We prefetch when queue length becomes 1 (i.e., current will play soon) and we see there's another item after it
    if (voiceServiceRef.current?.isElevenLabsEnabled()) {
      const q = ttsQueueRef.current;
      if (q.length >= 2) {
        const lookahead = q[1];
        if (lookahead.useElevenLabs && lookahead.voiceId) {
          try {
            // Abort any old prefetch
            if (prefetchAbortRef.current) { prefetchAbortRef.current.abort(); }
            const controller = new AbortController();
            prefetchAbortRef.current = controller;
            const normalizedLA = lookahead.text.replace(/\s+/g, ' ').trim();
            // Kick off a blob fetch in background
            (async () => {
              const blob = await voiceServiceRef.current!.textToSpeech(lookahead.text, lookahead.voiceId!);
              if (controller.signal.aborted) return;
              // Replace previous URL
              if (prefetchedUrlRef.current) { try { URL.revokeObjectURL(prefetchedUrlRef.current); } catch {} }
              const url = URL.createObjectURL(blob);
              prefetchedUrlRef.current = url;
              prefetchedTextRef.current = normalizedLA;
              prefetchedVoiceRef.current = lookahead.voiceId!;
              if (debugTiming) {
                // eslint-disable-next-line no-console
                console.log('[TTSQ] prefetched', { chars: lookahead.text.length, ts: Date.now() });
              }
            })().catch(() => {});
          } catch {}
        }
      }
    }
    if (debugTiming) {
      // eslint-disable-next-line no-console
      console.log('[TTSQ] enqueue', { id, chars: task.text.length, before, after: ttsQueueRef.current.length, ts: Date.now() });
    }
    // Start immediately if idle
    Promise.resolve().then(() => processNextRef.current());
    return true;
  }, [normalizeText, debugTiming]);

  const speak = useCallback(async (text: string, voiceId?: string, useElevenLabs = false, preferStreaming = true) => {
    // Always enqueue to enforce strict FIFO sequencing
    enqueue({ text, voiceId, useElevenLabs, preferStreaming });
    return true;
  }, [enqueue]);

  // Stop speaking
  const stop = useCallback(() => {
    // Stop Web Speech API
    if (synthesisRef.current) {
      synthesisRef.current.cancel();
    }
    
    // Stop shared audio element
    if (audioElRef.current) {
      try { audioElRef.current.pause(); } catch {}
      audioElRef.current.src = '';
    }
    if (streamingAbortRef.current) {
      streamingAbortRef.current.abort();
      streamingAbortRef.current = null;
    }
    if (prefetchAbortRef.current) {
      prefetchAbortRef.current.abort();
      prefetchAbortRef.current = null;
    }
    if (currentObjectUrlRef.current) {
      try { URL.revokeObjectURL(currentObjectUrlRef.current); } catch {}
      currentObjectUrlRef.current = null;
    }
    if (prefetchedUrlRef.current) {
      try { URL.revokeObjectURL(prefetchedUrlRef.current); } catch {}
      prefetchedUrlRef.current = null;
      prefetchedTextRef.current = null;
      prefetchedVoiceRef.current = null;
    }
    
    setState(prev => ({ 
      ...prev, 
      isSpeaking: false,
      currentText: null
    }));
    // Clear any queued items
    ttsQueueRef.current = [];
  }, []);

  // Reset queue explicitly (same as stop but does not alter external onEnd semantics)
  const resetQueue = useCallback(() => {
    stop();
  }, [stop]);

  // Pause speaking
  const pause = useCallback(() => {
    if (synthesisRef.current) {
      synthesisRef.current.pause();
    }
    if (audioElRef.current) {
      try { audioElRef.current.pause(); } catch {}
    }
  }, []);

  // Resume speaking
  const resume = useCallback(() => {
    if (synthesisRef.current) {
      synthesisRef.current.resume();
    }
    if (audioElRef.current) {
      try { audioElRef.current.play(); } catch {}
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Attempt to unlock autoplay by playing a short silent sound in a user gesture
  const unlockAudio = useCallback(async () => {
    const audio = ensureAudioEl();
    try {
      audio.muted = false;
      // If already playing or has a src that worked, skip
      if (!audio.src) {
        // 100ms silent mp3
        const silentDataUrl = 'data:audio/mp3;base64,//uQZAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
        audio.src = silentDataUrl;
      }
      await audio.play().catch(() => {});
      // Pause immediately; subsequent plays should be allowed
      try { audio.pause(); } catch {}
      return true;
    } catch {
      return false;
    }
  }, [ensureAudioEl]);

  return {
    // State
    ...state,
    
    // Actions
    speak,
    stop,
    resetQueue,
    pause,
    resume,
    clearError,
    unlockAudio,
    // Experimental: stream whole voice_chat turn directly (bypasses per-sentence queue)
    streamVoiceChat: async (
      message: string,
      history: Array<{ role: 'user' | 'assistant'; content: string }>,
      voiceId?: string,
      abortSignal?: AbortSignal,
      conversationId?: string,
      startNew?: boolean,
    ) => {
      const audio = ensureAudioEl();
      // Stay in "Thinking..." until audio actually starts playing
      // Pre-arm onStart to fire from the audio 'play' event
      shouldFireOnStartOnPlayRef.current = true;
      setState(prev => ({ ...prev, currentText: message, error: null }));
      const returnedConvoId = await voiceServiceRef.current!.streamVoiceChatToAudioElement(
        message,
        history,
        audio,
        abortSignal,
        conversationId,
        voiceId,
        startNew,
      );
      return returnedConvoId;
    },
    
    // Utilities
    isSupported: isSpeechSynthesisSupported,
    isElevenLabsEnabled: voiceServiceRef.current?.isElevenLabsEnabled() || false,
    // Diagnostics
    isTtsInFlight: ttsInFlightRef.current
  };
};
