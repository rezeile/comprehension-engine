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
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Voice service for ElevenLabs integration
  const voiceServiceRef = useRef<VoiceService | null>(null);

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

  // ElevenLabs TTS synthesis
  const speakWithElevenLabs = useCallback(async (text: string, selectedVoiceId: string) => {
    // Prevent multiple simultaneous speech instances
    if (state.isSpeaking) {
      return false;
    }

    // Add additional safeguard to prevent duplicate calls
    if (currentAudioRef.current) {
      return false;
    }

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
      
      const audioBlob = await voiceServiceRef.current.textToSpeech(text, selectedVoiceId);
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onplay = () => {
        setState(prev => ({ 
          ...prev, 
          isSpeaking: true, 
          currentText: text,
          error: null
        }));
        onStart?.();
      };
      
      audio.onended = () => {
        setState(prev => ({ 
          ...prev, 
          isSpeaking: false,
          currentText: null
        }));
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
        onEnd?.();
      };
      
      audio.onerror = () => {
        console.error('ElevenLabs audio playback error');
        setState(prev => ({ 
          ...prev, 
          isSpeaking: false,
          currentText: null,
          error: 'ElevenLabs audio playback failed'
        }));
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
        onError?.({
          error: 'audio-playback-failed',
          message: 'ElevenLabs audio playback failed'
        } as any);
      };
      
      currentAudioRef.current = audio;
      
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
        // Fallback to Web Speech API
        return speakWithWebSpeech(text);
      }
      
    } catch (error) {
      console.error('ElevenLabs TTS failed, falling back to Web Speech API:', error);
      setState(prev => ({ ...prev, error: 'ElevenLabs TTS failed' }));
      // Fallback to Web Speech API
      return speakWithWebSpeech(text);
    }
  }, [state.isSpeaking, onStart, onEnd, onError, speakWithWebSpeech]);

  // Main speak function
  const speak = useCallback(async (text: string, voiceId?: string, useElevenLabs = false) => {
    if (useElevenLabs && voiceId) {
      return speakWithElevenLabs(text, voiceId);
    } else {
      return speakWithWebSpeech(text);
    }
  }, [speakWithElevenLabs, speakWithWebSpeech]);

  // Stop speaking
  const stop = useCallback(() => {
    // Stop Web Speech API
    if (synthesisRef.current) {
      synthesisRef.current.cancel();
    }
    
    // Stop ElevenLabs audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    
    setState(prev => ({ 
      ...prev, 
      isSpeaking: false,
      currentText: null
    }));
  }, []);

  // Pause speaking
  const pause = useCallback(() => {
    if (synthesisRef.current) {
      synthesisRef.current.pause();
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
    }
  }, []);

  // Resume speaking
  const resume = useCallback(() => {
    if (synthesisRef.current) {
      synthesisRef.current.resume();
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.play();
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    // State
    ...state,
    
    // Actions
    speak,
    stop,
    pause,
    resume,
    clearError,
    
    // Utilities
    isSupported: isSpeechSynthesisSupported,
    isElevenLabsEnabled: voiceServiceRef.current?.isElevenLabsEnabled() || false
  };
};
