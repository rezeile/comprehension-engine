import { useState, useRef, useCallback, useEffect } from 'react';
import { AudioState } from '../types/common.types';
import { VoiceState } from '../types/voice.types';

export const useAudioState = () => {
  // Audio state
  const [audioState, setAudioState] = useState<AudioState>({
    isPlaying: false,
    isPaused: false,
    currentTime: 0,
    duration: 0,
    volume: 1.0
  });

  // Voice state
  const [voiceState, setVoiceState] = useState<VoiceState>({
    isRecording: false,
    isSpeaking: false,
    voiceEnabled: true,
    microphonePermission: 'prompt',
    manualActivation: false
  });

  // Refs for tracking spoken messages to prevent infinite loops
  const spokenMessagesRef = useRef<Set<string>>(new Set());

  // Check microphone permission on mount
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' as PermissionName }).then((result) => {
        setVoiceState(prev => ({ ...prev, microphonePermission: result.state as any }));
      });
    }
  }, []);

  // Update voice state
  const updateVoiceState = useCallback((updates: Partial<VoiceState>) => {
    setVoiceState(prev => ({ ...prev, ...updates }));
  }, []);

  // Update audio state
  const updateAudioState = useCallback((updates: Partial<AudioState>) => {
    setAudioState(prev => ({ ...prev, ...updates }));
  }, []);

  // Toggle voice output
  const toggleVoiceOutput = useCallback(() => {
    setVoiceState(prev => ({ ...prev, voiceEnabled: !prev.voiceEnabled }));
  }, []);

  // Enable voice output
  const enableVoice = useCallback(() => {
    setVoiceState(prev => ({ ...prev, voiceEnabled: true }));
  }, []);

  // Disable voice output
  const disableVoice = useCallback(() => {
    setVoiceState(prev => ({ ...prev, voiceEnabled: false }));
  }, []);

  // Set recording state
  const setRecording = useCallback((isRecording: boolean) => {
    setVoiceState(prev => ({ ...prev, isRecording }));
  }, []);

  // Set speaking state
  const setSpeaking = useCallback((isSpeaking: boolean) => {
    setVoiceState(prev => ({ ...prev, isSpeaking }));
  }, []);

  // Set manual activation state
  const setManualActivation = useCallback((manualActivation: boolean) => {
    setVoiceState(prev => ({ ...prev, manualActivation }));
  }, []);

  // Mark message as spoken
  const markMessageAsSpoken = useCallback((messageId: string) => {
    spokenMessagesRef.current.add(messageId);
  }, []);

  // Check if message has been spoken
  const isMessageSpoken = useCallback((messageId: string) => {
    return spokenMessagesRef.current.has(messageId);
  }, []);

  // Clear spoken messages
  const clearSpokenMessages = useCallback(() => {
    spokenMessagesRef.current.clear();
  }, []);

  // Reset audio state
  const resetAudioState = useCallback(() => {
    setAudioState({
      isPlaying: false,
      isPaused: false,
      currentTime: 0,
      duration: 0,
      volume: 1.0
    });
  }, []);

  // Reset voice state
  const resetVoiceState = useCallback(() => {
    setVoiceState({
      isRecording: false,
      isSpeaking: false,
      voiceEnabled: true,
      microphonePermission: 'prompt',
      manualActivation: false
    });
    clearSpokenMessages();
  }, [clearSpokenMessages]);

  // Reset all state
  const reset = useCallback(() => {
    resetAudioState();
    resetVoiceState();
  }, [resetAudioState, resetVoiceState]);

  // Check if audio is active (playing or recording)
  const isAudioActive = useCallback(() => {
    return audioState.isPlaying || voiceState.isRecording || voiceState.isSpeaking;
  }, [audioState.isPlaying, voiceState.isRecording, voiceState.isSpeaking]);

  // Check if microphone can be activated
  const canActivateMicrophone = useCallback(() => {
    return voiceState.voiceEnabled && 
           voiceState.microphonePermission === 'granted' && 
           !voiceState.isSpeaking;
  }, [voiceState.voiceEnabled, voiceState.microphonePermission, voiceState.isSpeaking]);

  // Check if voice output can be used
  const canUseVoiceOutput = useCallback(() => {
    return voiceState.voiceEnabled && !voiceState.isRecording;
  }, [voiceState.voiceEnabled, voiceState.isRecording]);

  // Get audio status summary
  const getAudioStatus = useCallback(() => {
    if (voiceState.isRecording) return 'recording';
    if (voiceState.isSpeaking) return 'speaking';
    if (audioState.isPlaying) return 'playing';
    if (voiceState.isRecording || voiceState.isSpeaking || audioState.isPlaying) return 'active';
    return 'idle';
  }, [voiceState.isRecording, voiceState.isSpeaking, audioState.isPlaying]);

  return {
    // State
    audioState,
    voiceState,
    
    // Actions
    updateVoiceState,
    updateAudioState,
    toggleVoiceOutput,
    enableVoice,
    disableVoice,
    setRecording,
    setSpeaking,
    setManualActivation,
    markMessageAsSpoken,
    clearSpokenMessages,
    resetAudioState,
    resetVoiceState,
    reset,
    
    // Utilities
    isAudioActive,
    canActivateMicrophone,
    canUseVoiceOutput,
    getAudioStatus,
    isMessageSpoken,
    
    // Refs
    spokenMessagesRef
  };
};
