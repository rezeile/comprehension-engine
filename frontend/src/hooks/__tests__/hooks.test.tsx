import React from 'react';
import { renderHook, act } from '@testing-library/react';
import {
  useVoiceRecognition,
  useVoiceSynthesis,
  useVoiceMode,
  useChat,
  useAudioState
} from '../index';

// Mock the VoiceService
jest.mock('../../services/VoiceService', () => ({
  VoiceService: jest.fn().mockImplementation(() => ({
    isElevenLabsEnabled: () => false,
    textToSpeech: jest.fn(),
    getAvailableVoices: jest.fn(),
    getDefaultVoiceId: jest.fn()
  }))
}));

// Mock browser APIs
Object.defineProperty(window, 'SpeechRecognition', {
  value: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    continuous: false,
    interimResults: false,
    maxAlternatives: 1,
    lang: 'en-US'
  }))
});

Object.defineProperty(window, 'webkitSpeechRecognition', {
  value: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    continuous: false,
    interimResults: false,
    maxAlternatives: 1,
    lang: 'en-US'
  }))
});

Object.defineProperty(window, 'speechSynthesis', {
  value: {
    speak: jest.fn(),
    cancel: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    getVoices: jest.fn(() => []),
    onvoiceschanged: null
  }
});

describe('Custom Hooks', () => {
  describe('useVoiceRecognition', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useVoiceRecognition());
      
      expect(result.current.isRecording).toBe(false);
      expect(result.current.isRecognitionRunning).toBe(false);
      expect(result.current.recognitionState).toBe('idle');
      expect(result.current.transcript).toBe('');
      expect(result.current.error).toBeNull();
    });

    it('should provide startRecording function', () => {
      const { result } = renderHook(() => useVoiceRecognition());
      
      expect(typeof result.current.startRecording).toBe('function');
    });

    it('should provide stopRecording function', () => {
      const { result } = renderHook(() => useVoiceRecognition());
      
      expect(typeof result.current.stopRecording).toBe('function');
    });
  });

  describe('useVoiceSynthesis', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useVoiceSynthesis());
      
      expect(result.current.isSpeaking).toBe(false);
      expect(result.current.currentText).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should provide speak function', () => {
      const { result } = renderHook(() => useVoiceSynthesis());
      
      expect(typeof result.current.speak).toBe('function');
    });

    it('should provide stop function', () => {
      const { result } = renderHook(() => useVoiceSynthesis());
      
      expect(typeof result.current.stop).toBe('function');
    });
  });

  describe('useVoiceMode', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useVoiceMode());
      
      expect(result.current.isVoiceMode).toBe(false);
      expect(result.current.transcriptionText).toBe('');
      expect(result.current.isAudioSettling).toBe(false);
      expect(result.current.isInCooldown).toBe(false);
    });

    it('should provide enterVoiceMode function', () => {
      const { result } = renderHook(() => useVoiceMode());
      
      expect(typeof result.current.enterVoiceMode).toBe('function');
    });

    it('should provide exitVoiceMode function', () => {
      const { result } = renderHook(() => useVoiceMode());
      
      expect(typeof result.current.exitVoiceMode).toBe('function');
    });

    it('should enter voice mode when enterVoiceMode is called', () => {
      const { result } = renderHook(() => useVoiceMode());
      
      act(() => {
        result.current.enterVoiceMode();
      });
      
      expect(result.current.isVoiceMode).toBe(true);
    });
  });

  describe('useChat', () => {
    it('should initialize with welcome message', () => {
      const { result } = renderHook(() => useChat());
      
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].sender).toBe('assistant');
      expect(result.current.messages[0].content).toContain('AI tutor');
    });

    it('should provide sendMessage function', () => {
      const { result } = renderHook(() => useChat());
      
      expect(typeof result.current.sendMessage).toBe('function');
    });

    it('should provide clearMessages function', () => {
      const { result } = renderHook(() => useChat());
      
      expect(typeof result.current.clearMessages).toBe('function');
    });
  });

  describe('useAudioState', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useAudioState());
      
      expect(result.current.voiceState.voiceEnabled).toBe(true);
      expect(result.current.voiceState.isRecording).toBe(false);
      expect(result.current.voiceState.isSpeaking).toBe(false);
    });

    it('should provide toggleVoiceOutput function', () => {
      const { result } = renderHook(() => useAudioState());
      
      expect(typeof result.current.toggleVoiceOutput).toBe('function');
    });

    it('should toggle voice output when toggleVoiceOutput is called', () => {
      const { result } = renderHook(() => useAudioState());
      
      act(() => {
        result.current.toggleVoiceOutput();
      });
      
      expect(result.current.voiceState.voiceEnabled).toBe(false);
    });
  });
});
