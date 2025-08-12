import React, { useState, useRef, useEffect, useCallback } from 'react';
import './ChatInterface.css';

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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

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
        
        // Process all results
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }
        
        // Update input with accumulated speech
        if (finalTranscript) {
          console.log('Final transcript:', finalTranscript);
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
  }, [isSpeechRecognitionSupported, isSpeechSynthesisSupported]);

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

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9; // Slightly slower for better comprehension
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => {
      setVoiceState(prev => ({ ...prev, isSpeaking: true }));
    };

    utterance.onend = () => {
      setVoiceState(prev => ({ ...prev, isSpeaking: false }));
    };

    utterance.onerror = () => {
      setVoiceState(prev => ({ ...prev, isSpeaking: false }));
    };

    currentUtteranceRef.current = utterance;
    synthesisRef.current?.speak(utterance);
  }, [isSpeechSynthesisSupported, voiceState.voiceEnabled]);

  // Auto-speak AI responses when voice is enabled
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (voiceState.voiceEnabled && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.sender === 'assistant' && !isLoading) {
        speakText(lastMessage.content);
      }
    }
  }, [messages, voiceState.voiceEnabled, isLoading, speakText]);

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
        // Start recording
        setVoiceState(prev => ({ ...prev, manualActivation: true, isRecording: true }));
        try {
          recognitionRef.current.start();
        } catch (error) {
          console.error('Error starting speech recognition:', error);
          setVoiceState(prev => ({ ...prev, isRecording: false, manualActivation: false }));
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
    if (!inputValue.trim() || isLoading) return;

    // Stop voice recording if it's active
    if (voiceState.isRecording) {
      stopVoiceRecording();
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue.trim(),
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
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
    if (synthesisRef.current) {
      synthesisRef.current.cancel();
      setVoiceState(prev => ({ ...prev, isSpeaking: false }));
    }
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
            className={`voice-toggle ${voiceState.voiceEnabled ? 'enabled' : 'disabled'}`}
            title={voiceState.voiceEnabled ? 'Disable voice output' : 'Enable voice output'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              {voiceState.isSpeaking ? (
                // Animated speaker icon when speaking
                <path d="M12 2L8 6H4V18H8L12 22V2Z" fill="currentColor" className="speaking-animation"/>
              ) : (
                // Regular speaker icon
                <path d="M12 2L8 6H4V18H8L12 22V2Z" fill="currentColor"/>
              )}
              <path d="M16 9C16 9 18 11 18 12C18 13 16 15 16 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M20 5C20 5 22 7 22 12C22 17 20 19 20 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          {!isSpeechRecognitionSupported && (
            <span className="compatibility-warning">Voice input not supported in this browser</span>
          )}
        </div>
      </div>
      
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
                  <path d="M8 22H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
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
        
        {/* Voice Recording Status */}
        {voiceState.isRecording && (
          <div className="voice-status">
            <span className="recording-indicator">🎤 Listening...</span>
            <span className="recording-hint">Speak now, click mic again to stop, or press Send</span>
          </div>
        )}
        
        {/* Microphone Permission Warning */}
        {voiceState.microphonePermission === 'denied' && (
          <div className="permission-warning">
            <span>🎤 Microphone access denied. Please enable it in your browser settings to use voice input.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface; 