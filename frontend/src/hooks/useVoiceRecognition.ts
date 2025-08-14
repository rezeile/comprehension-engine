import { useState, useRef, useCallback, useEffect } from 'react';
import { 
  VoiceRecognitionState, 
  VoiceRecognitionOptions,
  SpeechRecognitionEvent,
  SpeechRecognitionError 
} from '../types/voice.types';

export const useVoiceRecognition = (options: VoiceRecognitionOptions = {}) => {
  const {
    language = 'en-US',
    continuous = true,
    interimResults = true,
    maxAlternatives = 1,
    onTranscript,
    onError,
    onStart,
    onEnd
  } = options;

  // State management
  const [state, setState] = useState<VoiceRecognitionState>({
    isRecording: false,
    isRecognitionRunning: false,
    recognitionState: 'idle',
    transcript: '',
    error: null
  });

  // Refs for tracking recognition state
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isRecognitionRunningRef = useRef<boolean>(false);
  const recognitionStateRef = useRef<'idle' | 'starting' | 'running' | 'stopping' | 'error'>('idle');

  // Check browser compatibility
  const isSpeechRecognitionSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

  // Function to recreate speech recognition instance when needed
  const recreateRecognitionInstance = useCallback(() => {
    // Prevent multiple instances from running
    if (isRecognitionRunningRef.current || recognitionStateRef.current === 'running') {
      return true;
    }

    // Clean up old instance
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        // Silent cleanup
      }
      recognitionRef.current = null;
    }
    
    // Reset all tracking refs
    isRecognitionRunningRef.current = false;
    recognitionStateRef.current = 'idle';
    
    // Create new instance
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return false;
    }
    
    const newRecognition = new SpeechRecognition();
    recognitionRef.current = newRecognition;
    
    // Configure the new instance
    newRecognition.continuous = continuous;
    newRecognition.interimResults = interimResults;
    newRecognition.maxAlternatives = maxAlternatives;
    newRecognition.lang = language;

    // Set up handlers for the new instance
    newRecognition.onstart = () => {
      isRecognitionRunningRef.current = true;
      recognitionStateRef.current = 'running';
      setState(prev => ({ 
        ...prev, 
        isRecording: true, 
        isRecognitionRunning: true,
        recognitionState: 'running',
        error: null
      }));
      onStart?.();
    };

    newRecognition.onresult = (event: SpeechRecognitionEvent) => {
      // Build the complete transcript from ALL results in this session
      let completeTranscript = '';
      
      // Process ALL results to build the complete transcript
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        completeTranscript += transcript + ' ';
      }
      
      // Clean up the transcript
      completeTranscript = completeTranscript.trim();
      
      // Update our internal state
      setState(prev => ({
        ...prev,
        transcript: completeTranscript
      }));
      
      // Always send the complete transcript for display
      // This ensures the UI shows the complete message as it builds up
      onTranscript?.(completeTranscript, false);
    };

    newRecognition.onend = () => {
      isRecognitionRunningRef.current = false;
      recognitionStateRef.current = 'idle';
      setState(prev => ({ 
        ...prev, 
        isRecording: false, 
        isRecognitionRunning: false,
        recognitionState: 'idle'
      }));
      onEnd?.();
    };

    newRecognition.onerror = (event: SpeechRecognitionError) => {
      isRecognitionRunningRef.current = false;
      recognitionStateRef.current = 'error';
      
      const errorMessage = event.error || 'Unknown recognition error';
      setState(prev => ({ 
        ...prev, 
        isRecording: false, 
        isRecognitionRunning: false,
        recognitionState: 'error',
        error: errorMessage
      }));
      
      onError?.(event);
    };
    
    return true;
  }, [continuous, interimResults, maxAlternatives, language, onStart, onEnd, onError]);

  // Start recording
  const startRecording = useCallback(() => {
    if (!isSpeechRecognitionSupported) {
      setState(prev => ({ ...prev, error: 'Speech recognition not supported' }));
      return false;
    }

    // Check multiple state indicators to prevent double-start
    if (state.recognitionState === 'running' || 
        state.recognitionState === 'starting' ||
        isRecognitionRunningRef.current) {
      // Recognition already running, skip duplicate start
      return false;
    }
    
    // Validate recognition state before starting
    if (!recreateRecognitionInstance()) {
      setState(prev => ({ ...prev, error: 'Failed to initialize recognition' }));
      return false;
    }
    
    try {
      recognitionRef.current?.start();
      recognitionStateRef.current = 'starting';
      setState(prev => ({ ...prev, recognitionState: 'starting' }));
      return true;
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to start recording',
        recognitionState: 'error'
      }));
      return false;
    }
  }, [isSpeechRecognitionSupported, state.recognitionState, recreateRecognitionInstance]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (recognitionRef.current && (state.isRecording || isRecognitionRunningRef.current)) {
      recognitionStateRef.current = 'stopping';
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error('Error stopping voice recording:', error);
        // Force reset state if stop fails
        isRecognitionRunningRef.current = false;
        recognitionStateRef.current = 'idle';
        setState(prev => ({ 
          ...prev, 
          isRecording: false, 
          isRecognitionRunning: false,
          recognitionState: 'idle'
        }));
      }
    }
  }, [state.isRecording]);

  // Reset recognition state
  const reset = useCallback(() => {
    stopRecording();
    
    // Force cleanup of any lingering recognition instances
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        // Silent cleanup - recognition might already be stopped
      }
      recognitionRef.current = null;
    }
    
    setState({
      isRecording: false,
      isRecognitionRunning: false,
      recognitionState: 'idle',
      transcript: '',
      error: null
    });
    isRecognitionRunningRef.current = false;
    recognitionStateRef.current = 'idle';
  }, [stopRecording]);

  // Check microphone permission
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' as PermissionName }).then((result) => {
        if (result.state === 'denied') {
          setState(prev => ({ ...prev, error: 'Microphone permission denied' }));
        }
      });
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          // Silent cleanup
        }
      }
    };
  }, []);

  return {
    // State
    ...state,
    
    // Actions
    startRecording,
    stopRecording,
    reset,
    
    // Utilities
    isSupported: isSpeechRecognitionSupported,
    recreateInstance: recreateRecognitionInstance
  };
};
