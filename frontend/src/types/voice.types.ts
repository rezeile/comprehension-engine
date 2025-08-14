// Voice-related interfaces and types for the voice system

export interface VoiceState {
  isRecording: boolean;
  isSpeaking: boolean;
  voiceEnabled: boolean;
  microphonePermission: 'granted' | 'denied' | 'prompt';
  manualActivation: boolean;
}

export interface VoiceRecognitionState {
  isRecording: boolean;
  isRecognitionRunning: boolean;
  recognitionState: 'idle' | 'starting' | 'running' | 'stopping' | 'error';
  transcript: string;
  error: string | null;
}

export interface VoiceSynthesisState {
  isSpeaking: boolean;
  currentText: string | null;
  error: string | null;
}

export interface VoiceModeState {
  isVoiceMode: boolean;
  transcriptionText: string;
  isAudioSettling: boolean;
  isInCooldown: boolean;
  forcedSilenceEndTime: number;
  speechEndTime: number;
}

export interface VoiceRecognitionOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: SpeechRecognitionError) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

export interface VoiceSynthesisOptions {
  voice?: SpeechSynthesisVoice;
  rate?: number;
  pitch?: number;
  volume?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: SpeechSynthesisErrorEvent) => void;
}

export interface VoiceModeOptions {
  onEnter?: () => void;
  onExit?: () => void;
  onTranscriptionChange?: (text: string) => void;
}

// Speech recognition event types
export interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

export interface SpeechRecognitionError {
  error: string;
  message?: string;
}

// Speech synthesis event types
export interface SpeechSynthesisErrorEvent {
  error: string;
  message?: string;
}

// Voice service types
export interface Voice {
  id: string;
  name: string;
  category: string;
  description?: string;
}

export interface VoiceServiceState {
  selectedVoice: string;
  availableVoices: Voice[];
  isElevenLabsEnabled: boolean;
}
