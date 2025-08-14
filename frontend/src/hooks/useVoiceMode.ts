import { useState, useRef, useCallback, useEffect } from 'react';
import { VoiceModeState, VoiceModeOptions } from '../types/voice.types';

export const useVoiceMode = (options: VoiceModeOptions = {}) => {
  const {
    onEnter,
    onExit,
    onTranscriptionChange
  } = options;

  // State management
  const [state, setState] = useState<VoiceModeState>({
    isVoiceMode: false,
    transcriptionText: '',
    isAudioSettling: false,
    isInCooldown: false,
    forcedSilenceEndTime: 0,
    speechEndTime: 0
  });

  // Refs for tracking timing and state
  const speechEndTimeRef = useRef<number>(0);
  const forcedSilenceEndTimeRef = useRef<number>(0);
  const userSpeechSessionRef = useRef<boolean>(false);

  // Enter voice mode
  const enterVoiceMode = useCallback(() => {
    setState(prev => ({
      ...prev,
      isVoiceMode: true,
      transcriptionText: '',
      isAudioSettling: false,
      isInCooldown: false
    }));
    
    // Reset timing refs
    speechEndTimeRef.current = 0;
    forcedSilenceEndTimeRef.current = 0;
    userSpeechSessionRef.current = false;
    
    onEnter?.();
  }, [onEnter]);

  // Exit voice mode
  const exitVoiceMode = useCallback(() => {
    setState(prev => ({
      ...prev,
      isVoiceMode: false,
      transcriptionText: '',
      isAudioSettling: false,
      isInCooldown: false
    }));
    
    // Reset timing refs
    speechEndTimeRef.current = 0;
    forcedSilenceEndTimeRef.current = 0;
    userSpeechSessionRef.current = false;
    
    onExit?.();
  }, [onExit]);

  // Update transcription text
  const updateTranscription = useCallback((text: string, shouldAppend = false) => {
    // Since speech recognition now sends the complete transcript, we just use the text as is
    const newText = text.trim();
    
    setState(prev => ({
      ...prev,
      transcriptionText: newText
    }));
    
    onTranscriptionChange?.(newText);
  }, [onTranscriptionChange, state.transcriptionText]);

  // Clear transcription
  const clearTranscription = useCallback(() => {
    setState(prev => ({
      ...prev,
      transcriptionText: ''
    }));
    
    onTranscriptionChange?.('');
  }, [onTranscriptionChange]);

  // Handle AI speech start
  const onAISpeechStart = useCallback(() => {
    setState(prev => ({
      ...prev,
      isAudioSettling: false,
      isInCooldown: false
    }));
  }, []);

  // Handle AI speech end
  const onAISpeechEnd = useCallback(() => {
    const now = Date.now();
    speechEndTimeRef.current = now;
    
    // Set a longer forced silence period to account for audio lag
    forcedSilenceEndTimeRef.current = now + 4000; // 4 seconds for audio lag
    
    setState(prev => ({
      ...prev,
      isAudioSettling: true,
      isInCooldown: true
    }));
    
    // Resume after forced silence period
    setTimeout(() => {
      const timeSinceSpeechEnded = Date.now() - speechEndTimeRef.current;
      const timeUntilForcedSilenceEnds = forcedSilenceEndTimeRef.current - Date.now();
      
      if (timeSinceSpeechEnded < 3000 || timeUntilForcedSilenceEnds > 0) {
        // Wait longer if needed
        const waitTime = Math.max(3000 - timeSinceSpeechEnded, timeUntilForcedSilenceEnds);
        setTimeout(() => {
          setState(prev => ({
            ...prev,
            isAudioSettling: false,
            isInCooldown: false
          }));
        }, waitTime);
      } else {
        setState(prev => ({
          ...prev,
          isAudioSettling: false,
          isInCooldown: false
        }));
      }
    }, 3000);
    
    // Additional safety delay as backup
    setTimeout(() => {
      if (state.isInCooldown && state.isVoiceMode) {
        setState(prev => ({
          ...prev,
          isInCooldown: false,
          isAudioSettling: false
        }));
      }
    }, 5000);
  }, [state.isInCooldown, state.isVoiceMode]);

  // Force microphone activation (bypass cooldown)
  const forceMicrophoneActivation = useCallback(() => {
    setState(prev => ({
      ...prev,
      isInCooldown: false,
      isAudioSettling: false
    }));
    
    // Clear forced silence period
    forcedSilenceEndTimeRef.current = 0;
  }, []);

  // Check if microphone can be activated
  const canActivateMicrophone = useCallback(() => {
    return !state.isInCooldown && !state.isAudioSettling;
  }, [state.isInCooldown, state.isAudioSettling]);

  // Get remaining cooldown time
  const getRemainingCooldownTime = useCallback(() => {
    if (!state.isInCooldown) return 0;
    
    const now = Date.now();
    const remaining = Math.max(0, forcedSilenceEndTimeRef.current - now);
    return Math.ceil(remaining / 1000);
  }, [state.isInCooldown]);

  // Reset voice mode state
  const reset = useCallback(() => {
    setState({
      isVoiceMode: false,
      transcriptionText: '',
      isAudioSettling: false,
      isInCooldown: false,
      forcedSilenceEndTime: 0,
      speechEndTime: 0
    });
    
    // Reset timing refs
    speechEndTimeRef.current = 0;
    forcedSilenceEndTimeRef.current = 0;
    userSpeechSessionRef.current = false;
  }, []);

  // Update state from external sources
  const updateState = useCallback((updates: Partial<VoiceModeState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  return {
    // State
    ...state,
    
    // Actions
    enterVoiceMode,
    exitVoiceMode,
    updateTranscription,
    clearTranscription,
    onAISpeechStart,
    onAISpeechEnd,
    forceMicrophoneActivation,
    reset,
    updateState,
    
    // Utilities
    canActivateMicrophone,
    getRemainingCooldownTime,
    
    // Refs for external access
    speechEndTimeRef,
    forcedSilenceEndTimeRef
  };
};
