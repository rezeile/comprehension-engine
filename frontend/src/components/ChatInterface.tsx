import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import './ChatInterface.css';
import SettingsPanel from './SettingsPanel';
import { VoiceService, Voice } from '../services/VoiceService';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

interface ChatRequest {
  message: string;
  conversation_history: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

interface ChatResponse {
  response: string;
  conversation_id?: string;
}

// Voice-related interfaces
interface VoiceState {
  isRecording: boolean;
  isSpeaking: boolean;
  voiceEnabled: boolean;
  microphonePermission: 'granted' | 'denied' | 'prompt';
  manualActivation: boolean; // Flag to ensure manual activation only
}

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Hello! I\'m your AI tutor. How can I help you learn today?',
      sender: 'assistant',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>({
    isRecording: false,
    isSpeaking: false,
    voiceEnabled: true,
    microphonePermission: 'prompt',
    manualActivation: false // Initialize manualActivation to false
  });
  
  // ElevenLabs voice state
  const [selectedVoice, setSelectedVoice] = useState<string>('ErXwobaYiN019PkySvjV'); // Default to Antoni
  const [availableVoices, setAvailableVoices] = useState<Voice[]>([]);
  const [isElevenLabsEnabled, setIsElevenLabsEnabled] = useState<boolean>(false);
  
  // Settings panel state
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  
  // Voice mode state
  const [isVoiceMode, setIsVoiceMode] = useState<boolean>(false);
  const [transcriptionText, setTranscriptionText] = useState<string>('');
  
  // Use ref to track current voice mode state for speech recognition
  const isVoiceModeRef = useRef<boolean>(false);
  isVoiceModeRef.current = isVoiceMode;
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize VoiceService
  const voiceService = useMemo(() => new VoiceService(), []);

  // Check browser compatibility
  const isSpeechRecognitionSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  const isSpeechSynthesisSupported = 'speechSynthesis' in window;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize speech recognition
  useEffect(() => {
    if (isSpeechRecognitionSupported) {
      const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.maxAlternatives = 1;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onstart = () => {
        console.log('Speech recognition started');
        setVoiceState(prev => ({ ...prev, isRecording: true }));
      };

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interimTranscript = '';
        
        console.log('Speech recognition result event:', {
          resultIndex: event.resultIndex,
          resultsLength: event.results.length,
          isVoiceMode: isVoiceModeRef.current
        });
        
        // Process all results
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          console.log(`Result ${i}:`, {
            transcript: result[0].transcript,
            isFinal: result.isFinal,
            confidence: result[0].confidence
          });
          
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }
        
        console.log('Processed transcripts:', { finalTranscript, interimTranscript });
        
        // Update transcription text for voice mode
        if (isVoiceModeRef.current && finalTranscript) {
          console.log('Voice mode transcription:', finalTranscript);
          setTranscriptionText(prev => {
            const baseText = prev.replace(/\[interim\].*$/, ''); // Remove previous interim text
            const newText = baseText + finalTranscript;
            return interimTranscript ? `${newText} [interim]${interimTranscript}` : newText;
          });
        }
        
        // Update input with accumulated speech (for text mode only when not in voice mode)
        if (finalTranscript && !isVoiceModeRef.current) {
          console.log('Text mode transcript:', finalTranscript);
          setInputValue(prev => prev + ' ' + finalTranscript);
        }
        
        // Show interim results in real-time (optional)
        if (interimTranscript) {
          console.log('Interim transcript:', interimTranscript);
        }
      };

      recognitionRef.current.onend = () => {
        console.log('Speech recognition ended');
        
        // If we're still supposed to be recording, restart automatically
        if (voiceState.isRecording) {
          console.log('Restarting speech recognition...');
          try {
            recognitionRef.current?.start();
          } catch (error) {
            console.error('Error restarting speech recognition:', error);
            setVoiceState(prev => ({ ...prev, isRecording: false, manualActivation: false }));
          }
        } else {
          setVoiceState(prev => ({ ...prev, isRecording: false, manualActivation: false }));
        }
      };

      recognitionRef.current.onerror = (event: SpeechRecognitionError) => {
        console.error('Speech recognition error:', event.error);
        
        // Don't stop recording for certain errors that are recoverable
        if (event.error === 'no-speech' || event.error === 'audio-capture' || event.error === 'network') {
          console.log('Recoverable error, attempting to restart...');
          if (voiceState.isRecording) {
            try {
              recognitionRef.current?.start();
            } catch (error) {
              console.error('Error restarting after recoverable error:', error);
              setVoiceState(prev => ({ ...prev, isRecording: false, manualActivation: false }));
            }
          }
        } else {
          // For non-recoverable errors, stop recording
          setVoiceState(prev => ({ ...prev, isRecording: false, manualActivation: false }));
          
          if (event.error === 'not-allowed') {
            setVoiceState(prev => ({ ...prev, microphonePermission: 'denied' }));
          }
        }
      };
    }

    // Initialize speech synthesis
    if (isSpeechSynthesisSupported) {
      synthesisRef.current = window.speechSynthesis;
      
      // Get available voices and set a good one
      const setVoice = () => {
        const voices = synthesisRef.current?.getVoices() || [];
        const preferredVoice = voices.find(voice => 
          voice.lang.startsWith('en') && 
          (voice.name.includes('Google') || voice.name.includes('Natural') || voice.name.includes('Premium'))
        ) || voices.find(voice => voice.lang.startsWith('en')) || voices[0];
        
        if (preferredVoice) {
          console.log('Using voice:', preferredVoice.name);
        }
      };

      // Chrome loads voices asynchronously
      if (synthesisRef.current.onvoiceschanged !== undefined) {
        synthesisRef.current.onvoiceschanged = setVoice;
      } else {
        setVoice();
      }
    }

    // Check microphone permission
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' as PermissionName }).then((result) => {
        setVoiceState(prev => ({ ...prev, microphonePermission: result.state as any }));
      });
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (currentUtteranceRef.current) {
        synthesisRef.current?.cancel();
      }
    };
  }, [isSpeechRecognitionSupported, isSpeechSynthesisSupported, isVoiceMode]);

  // Cleanup effect to ensure speech recognition is stopped when component unmounts
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    return () => {
      if (recognitionRef.current && voiceState.isRecording) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Voice output functions
  const speakText = useCallback((text: string) => {
    if (!isSpeechSynthesisSupported || !voiceState.voiceEnabled) return;

    // Stop any current speech
    synthesisRef.current?.cancel();

    // Pause speech recognition while AI is speaking to prevent echo
    if (recognitionRef.current && voiceState.isRecording) {
      recognitionRef.current.stop();
      setVoiceState(prev => ({ ...prev, isRecording: false }));
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9; // Slightly slower for better comprehension
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => {
      setVoiceState(prev => ({ ...prev, isSpeaking: true }));
    };

    utterance.onend = () => {
      setVoiceState(prev => ({ ...prev, isSpeaking: false }));
      
      // Resume speech recognition after AI finishes speaking
      if (isVoiceMode && recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setVoiceState(prev => ({ ...prev, isRecording: true }));
        } catch (error) {
          console.error('Error resuming speech recognition:', error);
        }
      }
    };

    utterance.onerror = () => {
      setVoiceState(prev => ({ ...prev, isSpeaking: false }));
      
      // Resume speech recognition if there was an error
      if (isVoiceMode && recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setVoiceState(prev => ({ ...prev, isRecording: true }));
        } catch (error) {
          console.error('Error resuming speech recognition after error:', error);
        }
      }
    };

    currentUtteranceRef.current = utterance;
    synthesisRef.current?.speak(utterance);
  }, [isSpeechSynthesisSupported, voiceState.voiceEnabled, isVoiceMode]);

  // ElevenLabs TTS function
  const speakTextWithElevenLabs = useCallback(async (text: string) => {
    if (!voiceState.voiceEnabled || !isElevenLabsEnabled) return;
    
    try {
      // Stop any current speech from both systems
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      
      // Stop Web Speech API if it's running
      if (synthesisRef.current) {
        synthesisRef.current.cancel();
      }
      
      // Pause speech recognition while AI is speaking to prevent echo
      if (recognitionRef.current && voiceState.isRecording) {
        recognitionRef.current.stop();
        setVoiceState(prev => ({ ...prev, isRecording: false }));
      }
      
      const audioBlob = await voiceService.textToSpeech(text, selectedVoice);
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onplay = () => {
        setVoiceState(prev => ({ ...prev, isSpeaking: true }));
      };
      
      audio.onended = () => {
        setVoiceState(prev => ({ ...prev, isSpeaking: false }));
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
        
        // Resume speech recognition after AI finishes speaking
        if (isVoiceMode && recognitionRef.current) {
          try {
            recognitionRef.current.start();
            setVoiceState(prev => ({ ...prev, isRecording: true }));
          } catch (error) {
            console.error('Error resuming speech recognition:', error);
          }
        }
      };
      
      audio.onerror = () => {
        setVoiceState(prev => ({ ...prev, isSpeaking: false }));
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
        
        // Resume speech recognition if there was an error
        if (isVoiceMode && recognitionRef.current) {
          try {
            recognitionRef.current.start();
            setVoiceState(prev => ({ ...prev, isRecording: true }));
          } catch (error) {
            console.error('Error resuming speech recognition after error:', error);
          }
        }
      };
      
      currentAudioRef.current = audio;
      audio.play();
      
    } catch (error) {
      console.error('ElevenLabs TTS failed, falling back to Web Speech API:', error);
      speakText(text); // Fallback to existing implementation
    }
  }, [voiceState.voiceEnabled, isElevenLabsEnabled, selectedVoice, voiceService, speakText, isVoiceMode]);

  // Load available voices on component mount
  useEffect(() => {
    const loadVoices = async () => {
      try {
        const voices = await voiceService.getAvailableVoices();
        setAvailableVoices(voices);
        setIsElevenLabsEnabled(voiceService.isElevenLabsEnabled());
        
        // Set default voice if available
        if (voices.length > 0) {
          const defaultVoiceId = voiceService.getDefaultVoiceId();
          if (voices.find(v => v.id === defaultVoiceId)) {
            setSelectedVoice(defaultVoiceId);
          } else {
            setSelectedVoice(voices[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to load voices:', error);
        setIsElevenLabsEnabled(false);
      }
    };
    
    loadVoices();
  }, [voiceService]);



  // Auto-speak AI responses only when in voice mode
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isVoiceMode && voiceState.voiceEnabled && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.sender === 'assistant' && !isLoading) {
        // Use ElevenLabs if available, otherwise fallback to Web Speech API
        if (isElevenLabsEnabled) {
          speakTextWithElevenLabs(lastMessage.content);
        } else if (isSpeechSynthesisSupported) {
          // Only use Web Speech API if ElevenLabs is not available
          speakText(lastMessage.content);
        }
      }
    }
  }, [messages, isVoiceMode, voiceState.voiceEnabled, isLoading, speakText, speakTextWithElevenLabs, isElevenLabsEnabled, isSpeechSynthesisSupported]);

  const sendMessageToBackend = async (message: string): Promise<string> => {
    try {
      // Prepare conversation history for the API
      const conversationHistory = messages.slice(1).map(msg => ({
        role: msg.sender as 'user' | 'assistant',
        content: msg.content
      }));

      const requestBody: ChatRequest = {
        message: message,
        conversation_history: conversationHistory
      };

      // Use environment variable for backend URL, fallback to localhost for development
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
      
      const response = await fetch(`${backendUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ChatResponse = await response.json();
      return data.response;
    } catch (error) {
      console.error('Error sending message to backend:', error);
      throw new Error('Failed to get response from AI tutor. Please try again.');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    } else if (e.code === 'Space' && !e.shiftKey && !inputValue.trim()) {
      // Only intercept Spacebar for voice input when text input is empty
      e.preventDefault();
      toggleVoiceRecording();
    }
    // Allow Spacebar to work normally when typing
  };

  // Voice input functions
  const toggleVoiceRecording = () => {
    if (!isSpeechRecognitionSupported) {
      alert('Speech recognition is not supported in your browser.');
      return;
    }

    if (voiceState.microphonePermission === 'denied') {
      alert('Microphone permission is required for voice input. Please enable it in your browser settings.');
      return;
    }

    if (recognitionRef.current) {
      if (voiceState.isRecording) {
        // Stop recording if already recording
        recognitionRef.current.stop();
        setVoiceState(prev => ({ ...prev, isRecording: false, manualActivation: false }));
      } else {
        // Start recording and enter voice mode
        setVoiceState(prev => ({ ...prev, manualActivation: true, isRecording: true }));
        setIsVoiceMode(true);
        setTranscriptionText('');
        try {
          recognitionRef.current.start();
        } catch (error) {
          console.error('Error starting speech recognition:', error);
          setVoiceState(prev => ({ ...prev, isRecording: false, manualActivation: false }));
          setIsVoiceMode(false);
        }
      }
    }
  };

  // Function to stop voice recording (can be called externally)
  const stopVoiceRecording = () => {
    if (recognitionRef.current && voiceState.isRecording) {
      recognitionRef.current.stop();
      setVoiceState(prev => ({ ...prev, isRecording: false, manualActivation: false }));
    }
  };



  // Modified send message to stop recording if active
  const handleSendMessage = async () => {
    let messageToSend = '';
    
    if (isVoiceMode) {
      // In voice mode, use transcription text
      messageToSend = transcriptionText.replace(/\[interim\].*$/, '').trim();
      if (!messageToSend) return;
    } else {
      // In text mode, use input value
      messageToSend = inputValue.trim();
      if (!messageToSend || isLoading) return;
    }

    // Stop voice recording if it's active
    if (voiceState.isRecording) {
      stopVoiceRecording();
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: messageToSend,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    
    if (isVoiceMode) {
      // Stay in voice mode but clear transcription for next message
      setTranscriptionText('');
    } else {
      // Clear input in text mode
      setInputValue('');
    }
    
    setIsLoading(true);

    try {
      // Send message to backend and get AI response
      const aiResponse = await sendMessageToBackend(userMessage.content);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: aiResponse,
        sender: 'assistant',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      // Handle error by showing error message
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.',
        sender: 'assistant',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const stopSpeaking = useCallback(() => {
    // Stop Web Speech API
    if (synthesisRef.current) {
      synthesisRef.current.cancel();
    }
    
    // Stop ElevenLabs audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    
    setVoiceState(prev => ({ ...prev, isSpeaking: false }));
  }, []);

  const toggleVoiceOutput = useCallback(() => {
    if (voiceState.isSpeaking) {
      stopSpeaking();
    } else {
      setVoiceState(prev => ({ ...prev, voiceEnabled: !prev.voiceEnabled }));
    }
  }, [voiceState.isSpeaking, stopSpeaking]);

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h1>Comprehension Engine</h1>
        <p>AI-Powered Learning Assistant</p>
        
        <div className="voice-controls-header">
          <button
            onClick={toggleVoiceOutput}
            className={`voice-toggle ${voiceState.voiceEnabled ? 'enabled' : 'disabled'} ${voiceState.isSpeaking ? 'speaking' : ''}`}
            title={voiceState.voiceEnabled ? 'Disable voice output' : 'Enable voice output'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L8 6H4V18H8L12 22V2Z" fill="currentColor"/>
              <path d="M16 9C16 9 18 11 18 12C18 13 16 15 16 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M20 5C20 5 22 7 22 12C22 17 20 19 20 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          
          {/* Settings Gear Icon */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="settings-gear"
            title="Open settings"
            aria-label="Open settings"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M19.4 15C19.2669 15.3016 19.2272 15.6362 19.286 15.9606C19.3448 16.285 19.4995 16.5843 19.73 16.82L19.79 16.88C19.976 17.0657 20.1235 17.2863 20.2241 17.5291C20.3248 17.7719 20.3766 18.0322 20.3766 18.295C20.3766 18.5578 20.3248 18.8181 20.2241 19.0609C20.1235 19.3037 19.976 19.5243 19.79 19.71C19.6043 19.896 19.3837 20.0435 19.1409 20.1441C18.8981 20.2448 18.6378 20.2966 18.375 20.2966C18.1122 20.2966 17.8519 20.2448 17.6091 20.1441C17.3663 20.0435 17.1457 19.896 16.96 19.71L16.9 19.65C16.6643 19.4195 16.365 19.2648 16.0406 19.206C15.7162 19.1472 15.3816 19.1869 15.08 19.32C14.7842 19.4468 14.532 19.6572 14.3543 19.9255C14.1766 20.1938 14.0813 20.5082 14.08 20.83V21C14.08 21.5304 13.8693 22.0391 13.4942 22.4142C13.1191 22.7893 12.6104 23 12.08 23C11.5496 23 10.9609 22.7893 10.6658 22.4142C10.3707 22.0391 10.08 21.5304 10.08 21V20.91C10.0723 20.579 9.96512 20.257 9.77251 19.9887C9.5799 19.7204 9.31074 19.5206 9 19.41C8.69838 19.2769 8.36381 19.2372 8.03941 19.296C7.71502 19.3548 7.41568 19.5095 7.18 19.74L7.12 19.8C6.93425 19.986 6.71368 20.1335 6.47088 20.2341C6.22808 20.3348 5.96783 20.3866 5.705 20.3866C5.44217 20.3866 5.18192 20.2448 5.93912 20.1441C4.69632 20.0435 4.47575 19.896 4.29 19.71C4.10405 19.5243 3.95653 19.3037 3.85588 19.0609C3.75523 18.8181 3.70343 18.5578 3.70343 18.295C3.70343 18.0322 3.75523 17.7719 3.85588 17.5291C3.95653 17.2863 4.10405 17.0657 4.29 16.88L4.35 16.82C4.58054 16.5843 4.73519 16.285 4.794 15.9606C4.85282 15.6362 4.81312 15.3016 4.68 15C4.55324 14.7042 4.34276 14.452 4.07447 14.2743C3.80618 14.0966 3.49179 14.0013 3.17 14H3C2.46957 14 1.96086 13.7893 1.58579 13.4142C1.21071 13.0391 1 12.5304 1 12C1 11.4696 1.21071 10.9609 1.58579 10.5858C1.96086 10.2107 2.46957 10 3 10H3.09C3.41179 9.99869 3.72618 9.90339 3.99447 9.72569C4.26276 9.54799 4.47324 9.29578 4.6 9C4.73312 8.69838 4.77282 8.36381 4.714 8.03941C4.65519 7.71502 4.50054 7.41568 4.27 7.18L4.21 7.12C4.02405 6.93425 3.87653 6.71368 3.77588 6.47088C3.67523 6.22808 3.62343 5.96783 3.62343 5.705C3.62343 5.44217 3.67523 5.18192 3.77588 4.93912C3.87653 4.69632 4.02405 4.47575 4.21 4.29C4.39575 4.10405 4.61632 3.95653 4.85912 3.85588C5.10192 3.75523 5.36217 3.70343 5.625 3.70343C5.88783 3.70343 6.14808 3.75523 6.39088 3.85588C6.63368 3.95653 6.85425 4.10405 7.04 4.29L7.1 4.35C7.33568 4.58054 7.63502 4.73519 7.95941 4.794C8.28381 4.85282 8.61838 4.81312 8.92 4.68H9C9.29578 4.55324 9.548 4.34276 9.72569 4.07447C9.90339 3.80618 9.99869 3.49179 10.08 3.17V3C10.08 2.46957 10.2907 1.96086 10.6658 1.58579C11.0409 1.21071 11.5496 1 12.08 1C12.6104 1 13.1191 1.21071 13.4942 1.58579C13.8693 1.96086 14.08 2.46957 14.08 3V3.09C14.1613 3.41179 14.2566 3.72618 14.4343 3.99447C14.612 4.26276 14.8642 4.47324 15.16 4.6C15.4616 4.73312 15.7962 4.77282 16.1206 4.714C16.445 4.65519 16.7443 4.50054 16.98 4.27L17.04 4.21C17.2257 4.02405 17.4463 3.87653 17.6891 3.77588C17.9319 3.67523 18.1922 3.62343 18.455 3.62343C18.7178 3.62343 18.9781 3.67523 19.2209 3.77588C19.4637 3.87653 19.6843 4.02405 19.87 4.21C20.056 4.39575 20.2035 4.61632 20.3041 4.85912C20.4048 5.10192 20.4566 5.36217 20.4566 5.625C20.4566 5.88783 20.4048 6.14808 20.3041 6.39088C20.2035 6.63368 20.056 6.85425 19.87 7.04L19.81 7.1C19.5795 7.33568 19.4248 7.63502 19.366 7.95941C19.3072 8.28381 19.3469 8.61838 19.48 8.92V9C19.6068 9.29578 19.8172 9.548 20.0855 9.72569C20.3538 9.90339 20.6682 9.99869 20.99 10.08H21C21.5304 10.08 22.0391 10.2907 22.4142 10.5858C22.7893 10.9609 23 11.4696 23 12C23 12.5304 22.7893 13.0391 22.4142 13.4142C22.0391 13.7893 21.5304 14 21 14H20.91C20.5882 14.0013 20.2738 14.0966 20.0055 14.2743C19.7372 14.452 19.5268 14.7042 19.4 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          
          {!isSpeechRecognitionSupported && (
            <span className="compatibility-warning">Voice input not supported in this browser</span>
          )}
        </div>
      </div>
      
      {/* Voice Mode Interface */}
      {isVoiceMode ? (
        <div className="voice-mode-interface">
          <div className="voice-mode-content">
            <div className="voice-status-display">
              <div className="voice-mode-indicator">
                {voiceState.isSpeaking ? (
                  <>
                    <div className="speaking-waves">
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <p>AI is speaking...</p>
                  </>
                ) : voiceState.isRecording ? (
                  <>
                    <div className="speaking-waves">
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <p>Listening...</p>
                  </>
                ) : (
                  <p>Ready and listening</p>
                )}
              </div>
              
              {/* Transcription Feedback Display */}
              <div className="transcription-feedback">
                {transcriptionText ? (
                  <div className="transcription-display">
                    <div className="transcription-textarea">
                      {transcriptionText.replace(/\[interim\].*$/, '')}
                      {transcriptionText.includes('[interim]') && (
                        <span className="interim-text">
                          {transcriptionText.split('[interim]')[1]}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="conversation-state">
                    {voiceState.isSpeaking ? (
                      <div className="speaking-indicator">
                        <div className="speaking-waves">
                          <span></span>
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                        <p>Antoni is speaking...</p>
                      </div>
                    ) : (
                      <div className="listening-indicator">
                        <div className="listening-dots">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                        <p>Ready to listen</p>
                      </div>
                    )}
                  </div>
                )}
                

              </div>
            </div>
            
            <div className="voice-controls">
              <button
                onClick={() => setIsVoiceMode(false)}
                className="voice-control-btn cancel-btn"
                title="Exit voice mode"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              
              <button
                onClick={handleSendMessage}
                disabled={!transcriptionText.replace(/\[interim\].*$/, '').trim() || isLoading}
                className="voice-control-btn send-btn"
                title="Send transcription"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="messages-container">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`message ${message.sender === 'user' ? 'user-message' : 'assistant-message'}`}
              >
                <div className="message-content">
                  {message.content}
                </div>
                <div className="message-timestamp">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="message assistant-message">
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          <div className="input-container">
            <div className="input-wrapper">
              <textarea
                value={inputValue}
                            onChange={(e) => {
              // If voice recording is active, stop it when user starts typing
              if (voiceState.isRecording) {
                stopVoiceRecording();
              }
              setInputValue(e.target.value);
            }}
                              onKeyPress={handleKeyPress}
              placeholder="Type your message here... (or click mic to start voice input)"
                disabled={isLoading}
                rows={1}
                className="message-input"
              />
              
              {/* Voice Input Button */}
              {isSpeechRecognitionSupported && (
                <button
                  onClick={voiceState.isRecording ? stopVoiceRecording : toggleVoiceRecording}
                  disabled={isLoading || voiceState.microphonePermission === 'denied'}
                  className={`voice-input-button ${voiceState.isRecording ? 'recording' : ''}`}
                  title={voiceState.isRecording ? 'Stop recording (click again)' : 'Start voice input'}
                >
                  {voiceState.isRecording ? (
                    // Recording state - pulsing microphone
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="recording-animation">
                      <path d="M12 2A3 3 0 0 0 9 5V11A3 3 0 0 0 15 11V5A3 3 0 0 0 12 2Z" fill="currentColor"/>
                      <path d="M19 10V11A7 7 0 0 1 5 11V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <path d="M12 18.5V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <path d="M8 22H16" className="recording-animation"/>
                    </svg>
                  ) : (
                    // Idle state - regular microphone
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2A3 3 0 0 0 9 5V11A3 3 0 0 0 15 11V5A3 3 0 0 0 12 2Z" fill="currentColor"/>
                      <path d="M19 10V11A7 7 0 0 1 5 11V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <path d="M12 18.5V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <path d="M8 22H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  )}
                </button>
              )}
              
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isLoading}
                className="send-button"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            

            
            {/* Microphone Permission Warning */}
            {voiceState.microphonePermission === 'denied' && (
              <div className="permission-warning">
                <span>🎤 Microphone access denied. Please enable it in your browser settings to use voice input.</span>
              </div>
            )}
          </div>
        </>
      )}
      
      {/* Settings Panel */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        selectedVoice={selectedVoice}
        onVoiceChange={setSelectedVoice}
        voices={availableVoices}
        voiceEnabled={voiceState.voiceEnabled}
        onVoiceToggle={toggleVoiceOutput}
      />
    </div>
  );
};

export default ChatInterface; 