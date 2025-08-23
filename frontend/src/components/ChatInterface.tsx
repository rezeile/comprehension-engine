import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import './ChatInterface.css';
import SettingsPanel from './SettingsPanel';
import { VoiceService, Voice } from '../services/VoiceService';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { useVoiceSynthesis } from '../hooks/useVoiceSynthesis';
import { useVoiceMode } from '../hooks/useVoiceMode';
import { useChat } from '../hooks/useChat';
import { useAudioState } from '../hooks/useAudioState';
import { ConversationService } from '../services/ConversationService';
import { useNavigate } from 'react-router-dom';

import ChatHeader from './ChatHeader';
import HistoryDrawer from './HistoryDrawer/HistoryDrawer';
import { useConversations } from '../hooks/useConversations';
import ChatMessages from './ChatMessages';
import ChatInput from './ChatInput';
import VoiceMode from './VoiceMode';

interface ChatInterfaceProps {
  conversationId?: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ conversationId }) => {
  // Use custom hooks for state management
  const navigate = useNavigate();
  const ttsDebug = process.env.REACT_APP_TTS_TIMING_DEBUG === 'true';
  // Sentence ordering buffer for streaming
  const expectedSentenceIdxRef = useRef<number>(0);
  const sentenceBufferRef = useRef<Map<number, string>>(new Map());
  const streamEnqueueRef = useRef<(s: string) => void>(() => {});
  const streamEnqueueReadyRef = useRef<boolean>(false);
  const currentVoiceTurnStartRef = useRef<number>(0);
  const enqueuedSentenceIdxRef = useRef<Set<number>>(new Set());
  const lastEnqueuedTextRef = useRef<string>('');
  const flushBufferedSentencesRef = useRef<() => void>(() => {});
  const pendingTtsCountRef = useRef<number>(0);
  const setPendingTtsCount = useState<number>(0)[1];
  // Prevent STT from resuming until first audio actually starts
  const awaitingSpeechStartRef = useRef<boolean>(false);
  // Block any auto-speak in chat mode after exiting voice mode
  const blockAutoSpeakRef = useRef<boolean>(false);
  const onStreamSentenceWithIndex = (sentence: string, index: number) => {
    try {
      const s = (sentence || '').trim();
      if (!s) return;
      sentenceBufferRef.current.set(index, s);
      flushBufferedSentencesRef.current();
    } catch {}
  };

  const {
    messages,
    isLoading,
    isStreaming,
    sendMessage,
    // sendMessageStreamed,
    hydrateFromTurns,
    clearMessages
  } = useChat({
    conversationId,
    // Use ordered callback to guarantee FIFO even if network delivers out-of-order
    onStreamSentenceWithIndex,
    onStreamStart: () => {
      // New assistant turn begins: cancel any in-progress TTS and clear queued sentences
      resetQueue();
      // Reset ordering buffer
      expectedSentenceIdxRef.current = 0;
      sentenceBufferRef.current.clear();
      enqueuedSentenceIdxRef.current.clear();
      currentVoiceTurnStartRef.current = Date.now();
      pendingTtsCountRef.current = 0;
      setPendingTtsCount(0);
      if (ttsDebug) {
        // eslint-disable-next-line no-console
        console.log('[TTSQ] stream-start', { ts: Date.now() });
      }
      // Enqueue function is already bound at mount; mark ready and flush any early arrivals
      streamEnqueueReadyRef.current = true;
      flushBufferedSentencesRef.current();
      // Pause STT immediately before first sentence begins
      if (isVoiceMode && isRecognitionRecording) {
        try { stopRecording(); } catch {}
      }
    },
    onStreamDone: () => {
      // Prevent auto-speak of the full message after sentence streaming
      const last = messages[messages.length - 1];
      if (last && last.sender === 'assistant') {
        if (!spokenMessageIds.current.has(last.id)) {
          spokenMessageIds.current.add(last.id);
          saveSpokenMessage(last.id);
        }
      }
    }
  });

  // (moved below after hooks initialized)
  
  // Track when we're in the "sending message" state (user clicked send, waiting for AI)
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  
  // Use a ref to track current voice mode state to avoid stale closures
  const isVoiceModeRef = useRef(false);
  
  // Use a ref to track which messages have already been spoken to prevent infinite loops
  const spokenMessageIds = useRef<Set<string>>(new Set());
  
  // Use a ref to track failed speech attempts to prevent infinite retries
  const failedSpeechAttempts = useRef<Map<string, number>>(new Map());
  const MAX_SPEECH_RETRIES = 2;
  
  // Track when voice mode was last entered to determine message freshness
  const voiceModeEnterTime = useRef<number>(0);
  
  // Load previously spoken messages from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('comprehension-engine-spoken-messages');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Only restore messages from the last 24 hours to prevent accumulation
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        const recentMessages = parsed.filter((msg: any) => msg.timestamp > oneDayAgo);
        spokenMessageIds.current = new Set(recentMessages.map((msg: any) => msg.id));
      }
    } catch (error) {
      console.warn('Failed to load spoken messages from localStorage:', error);
    }
    
    // Cleanup function to clear old spoken messages periodically
    const cleanupInterval = setInterval(() => {
      try {
        const stored = localStorage.getItem('comprehension-engine-spoken-messages');
        if (stored) {
          const parsed = JSON.parse(stored);
          const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
          const recentMessages = parsed.filter((msg: any) => msg.timestamp > oneDayAgo);
          localStorage.setItem('comprehension-engine-spoken-messages', JSON.stringify(recentMessages));
        }
      } catch (error) {
        console.warn('Failed to cleanup old spoken messages:', error);
      }
    }, 60 * 60 * 1000); // Clean up every hour
    
    return () => clearInterval(cleanupInterval);
  }, []);
  
  // Save spoken messages to localStorage
  const saveSpokenMessage = useCallback((messageId: string) => {
    try {
      const stored = localStorage.getItem('comprehension-engine-spoken-messages') || '[]';
      const parsed = JSON.parse(stored);
      const newEntry = { id: messageId, timestamp: Date.now() };
      
      // Remove duplicates and old entries (older than 24 hours)
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      const filtered = parsed.filter((msg: any) => msg.id !== messageId && msg.timestamp > oneDayAgo);
      filtered.push(newEntry);
      
      localStorage.setItem('comprehension-engine-spoken-messages', JSON.stringify(filtered));
    } catch (error) {
      console.warn('Failed to save spoken message to localStorage:', error);
    }
  }, []);
  
  // Removed clearSpokenMessages UI; keep for potential future use
  
  // Removed debug status UI
  
  const {
    isRecording: isRecognitionRecording,
    isRecognitionRunning,
    startRecording,
    stopRecording,
    isSupported: isSpeechRecognitionSupported
  } = useVoiceRecognition({
    onTranscript: (text, isFinal) => {
      // Use the ref to get the current voice mode state
      const currentIsVoiceMode = isVoiceModeRef.current;
      
      // Handle transcription updates - always show the complete transcript
      if (currentIsVoiceMode) {
        // Speech recognition now sends the complete transcript every time
        // This gives users smooth, real-time feedback as they speak
        updateTranscription(text, false);
      }
    }
  });
  
  const {
    isSpeaking,
    speak,
    resetQueue,
    stop,
    unlockAudio,
    isElevenLabsEnabled: isElevenLabsSupported,
    streamVoiceChat
  } = useVoiceSynthesis({
    onStart: () => {
      // Handle speech start - now we can reset the sending state
      setIsSendingMessage(false);
    },
    onEnd: () => {
      // Handle speech end and try to drain next buffered sentence
      if (pendingTtsCountRef.current > 0) {
        pendingTtsCountRef.current -= 1;
        setPendingTtsCount(pendingTtsCountRef.current);
        if (ttsDebug) {
          // eslint-disable-next-line no-console
          console.log('[TTSQ] onEnd: pending--', { pending: pendingTtsCountRef.current, ts: Date.now() });
        }
      }
      flushBufferedSentencesRef.current();
    }
  });

  // Keep an always-fresh flusher that knows the latest speaking state
  useEffect(() => {
    flushBufferedSentencesRef.current = () => {
      if (!streamEnqueueReadyRef.current) return;
      if (sentenceBufferRef.current.has(expectedSentenceIdxRef.current)) {
        const s = sentenceBufferRef.current.get(expectedSentenceIdxRef.current) || '';
        if (!s.trim()) return;
        // Deduplicate by index in case of malformed repeats
        if (enqueuedSentenceIdxRef.current.has(expectedSentenceIdxRef.current)) return;
        // Deduplicate by content (normalize whitespace and punctuation spacing)
        const norm = s.replace(/\s+/g, ' ').trim();
        if (lastEnqueuedTextRef.current === norm) {
          sentenceBufferRef.current.delete(expectedSentenceIdxRef.current);
          enqueuedSentenceIdxRef.current.add(expectedSentenceIdxRef.current);
          expectedSentenceIdxRef.current += 1;
          return;
        }
        // Track a pending TTS unit before enqueue
        pendingTtsCountRef.current += 1;
        setPendingTtsCount(pendingTtsCountRef.current);
        streamEnqueueRef.current(s);
        sentenceBufferRef.current.delete(expectedSentenceIdxRef.current);
        enqueuedSentenceIdxRef.current.add(expectedSentenceIdxRef.current);
        lastEnqueuedTextRef.current = norm;
        expectedSentenceIdxRef.current += 1;
      }
    };
  }, [isSpeaking, setPendingTtsCount]);

  // Placeholder; actual binding is placed after selectedVoice and voiceState are defined
  
  const {
    isVoiceMode,
    transcriptionText,
    isInCooldown,
    enterVoiceMode,
    exitVoiceMode,
    updateTranscription,
    clearTranscription
  } = useVoiceMode({
    onEnter: () => {
      // Don't start recording here - let the toggle function handle it
      blockAutoSpeakRef.current = false;
    },
    onExit: () => {
      stopRecording();
      // Stop any TTS and clear queue
      stop();
      // Clear transcription when exiting voice mode
      updateTranscription('', false);
      blockAutoSpeakRef.current = true;
    }
  });

  // Update the ref whenever isVoiceMode changes
  useEffect(() => {
    isVoiceModeRef.current = isVoiceMode;
  }, [isVoiceMode]);
  
  const {
    voiceState,
    toggleVoiceOutput
  } = useAudioState();
  
  // ElevenLabs voice state
  const [selectedVoice, setSelectedVoice] = useState<string>('ErXwobaYiN019PkySvjV'); // Default to Antoni
  const [availableVoices, setAvailableVoices] = useState<Voice[]>([]);
  
  // Settings panel state
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  
  // Initialize VoiceService
  const voiceService = useMemo(() => new VoiceService(), []);
  const conversationService = useMemo(() => new ConversationService(), []);

  // Bind the stream enqueue function after hooks and state are initialized
  useEffect(() => {
    streamEnqueueRef.current = (s: string) => {
      if (!isVoiceModeRef.current) return;
      if (!voiceState.voiceEnabled) return;
      speak(s, selectedVoice, true, true);
    };
    // Try a flush in case sentences arrived before binding
    flushBufferedSentencesRef.current();
    streamEnqueueReadyRef.current = true;
  }, [speak, selectedVoice, voiceState.voiceEnabled]);

  // Bind the stream enqueue function after voice state is available
  useEffect(() => {
    streamEnqueueRef.current = (s: string) => {
      if (!isVoiceModeRef.current) return;
      if (!voiceState.voiceEnabled) return;
      speak(s, selectedVoice, true, true);
    };
  }, [speak, selectedVoice, voiceState.voiceEnabled]);

  // History drawer state
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const { conversations, isLoading: isHistoryLoading, hasMore, loadMore, renameConversation, refreshList } = useConversations();

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const messagesEndRef = document.createElement('div');
    messagesEndRef.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load available voices on component mount
  useEffect(() => {
    const loadVoices = async () => {
      try {
        const voices = await voiceService.getAvailableVoices();
        setAvailableVoices(voices);
        
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
      }
    };
    
    loadVoices();
  }, [voiceService]);

  // Auto-speak AI responses only when NOT in voice mode and only if user has voice explicitly enabled
  useEffect(() => {
    if (isVoiceMode) return; // voice mode handled by sentence streaming
    if (!voiceState.voiceEnabled) return; // never auto-speak in text mode unless explicitly enabled
    if (blockAutoSpeakRef.current) return; // block auto speak after exit
    if (isStreaming) return; // guard during streaming to avoid full-message auto-speak
    if (messages.length > 1) {
      const lastMessage = messages[messages.length - 1];
      // If the last assistant message belongs to the current streamed turn, skip auto-speak after exit
      if (lastMessage.sender === 'assistant' && currentVoiceTurnStartRef.current > 0 && lastMessage.timestamp.getTime() >= currentVoiceTurnStartRef.current) {
        return;
      }
      
      // Check if we've exceeded retry attempts for this message
      const retryCount = failedSpeechAttempts.current.get(lastMessage.id) || 0;
      if (retryCount >= MAX_SPEECH_RETRIES) {
        return;
      }
      
      // Check if this message is fresh enough to speak (within last 5 minutes of entering voice mode)
      const messageAge = Date.now() - lastMessage.timestamp.getTime();
      const voiceModeAge = Date.now() - voiceModeEnterTime.current;
      const isMessageFresh = messageAge < 5 * 60 * 1000; // 5 minutes
      const isVoiceModeFresh = voiceModeAge < 5 * 60 * 1000; // 5 minutes
      
      // Only speak if this is an assistant message, not loading, hasn't been spoken before, 
      // not currently speaking, and the message is fresh relative to voice mode entry
      if (lastMessage.sender === 'assistant' && 
          !isLoading && 
          !spokenMessageIds.current.has(lastMessage.id) && 
          !isSpeaking &&
          isMessageFresh &&
          isVoiceModeFresh) {
        
        // Add additional safeguard: check if we're already processing this message
        if (spokenMessageIds.current.has(lastMessage.id)) {
          return;
        }
        
        // Mark this message as spoken to prevent infinite loops
        spokenMessageIds.current.add(lastMessage.id);
        
        // Save to persistent storage
        saveSpokenMessage(lastMessage.id);
        
        // Message is fresh and ready to speak
        
        // Use ElevenLabs if available, otherwise fallback to Web Speech API
        if (isElevenLabsSupported) {
          speak(lastMessage.content, selectedVoice, true);
        } else {
          speak(lastMessage.content);
        }
      }
    }
  }, [messages, isVoiceMode, isStreaming, voiceState.voiceEnabled, isLoading, speak, isElevenLabsSupported, selectedVoice, isSpeaking, saveSpokenMessage]);

  // Create stable references for the recording functions
  const stableStopRecording = useCallback(() => {
    stopRecording();
  }, [stopRecording]);

  const stableStartRecording = useCallback(() => {
    startRecording();
  }, [startRecording]);

  // Handle TTS state changes to manage speech recognition properly
  useEffect(() => {
    
    if (isVoiceMode && isSpeaking) {
      // When AI starts speaking, pause speech recognition temporarily
      if (isRecognitionRecording) {
        stableStopRecording();
      }
    } else if (isVoiceMode && !isSpeaking && !isRecognitionRecording) {
      // When AI stops speaking, resume speech recognition if we're still in voice mode
      // Add a small delay to avoid audio feedback issues
      setTimeout(() => {
        // Do not resume STT if we are still in a streamed assistant turn or have buffered sentences
        const hasBuffered = sentenceBufferRef.current.size > 0;
        if (isVoiceMode && !isRecognitionRecording && !isRecognitionRunning && !isStreaming && !hasBuffered && !awaitingSpeechStartRef.current) {
          stableStartRecording();
        }
      }, 300);
    }
  }, [isSpeaking, isVoiceMode, isRecognitionRecording, isRecognitionRunning, isStreaming, stableStopRecording, stableStartRecording]);

  // Voice input functions - now handled by custom hooks
  const toggleVoiceRecording = () => {
    if (isVoiceMode) {
      exitVoiceMode();
    } else {
      // Track when voice mode is entered to determine message freshness
      voiceModeEnterTime.current = Date.now();
      
      // Track when voice mode is entered
      
      enterVoiceMode();
      // Best-effort unlock of autoplay on user gesture
      void unlockAudio();
      
      // Start recording after entering voice mode, but only if not already recording
      setTimeout(() => {
        // Clear transcription when starting new recording session
        updateTranscription('', false);
        
        // Only start recording if not already recording
        if (!isRecognitionRecording && !isRecognitionRunning) {
          startRecording();
        }
      }, 100);
    }
  };

  // Modified send message to handle both voice and text input
  const handleSendMessage = async (messageText?: string) => {
    
    let messageToSend = '';
    
    if (isVoiceMode) {
      // In voice mode, use transcription text
      messageToSend = transcriptionText.replace(/\[interim\].*$/, '').trim();
      if (!messageToSend) {
        return;
      }
    } else {
      // In text mode, use provided message text
      messageToSend = messageText?.trim() || '';
      if (!messageToSend || isLoading) {
        return;
      }
    }

    // Stop voice recording if it's active
    if (isRecognitionRecording) {
      stopRecording();
    }

    // Set sending state to true FIRST
    setIsSendingMessage(true);

    // Clear transcription immediately when sending to hide the text box
    if (isVoiceMode) {
      // Use clearTranscription for immediate state update
      clearTranscription();
    }

    // Use voice_chat streaming path in voice mode, normal path otherwise
    try {
      // Cancel any in-progress TTS and clear queue at the moment a new turn starts
      resetQueue();
      let returnedConversationId: string | undefined = undefined;
      if (isVoiceMode) {
        // Stream full audio turn via hook to ensure speaking state flips immediately
        const history = messages.slice(1).map(m => ({ role: m.sender as 'user' | 'assistant', content: m.content }));
        try { await unlockAudio(); } catch {}
        try {
          awaitingSpeechStartRef.current = true;
          returnedConversationId = await streamVoiceChat(messageToSend, history, selectedVoice, undefined, conversationId);
        } catch (e) {
          console.error('voice_chat stream failed', e);
        }
      } else {
        returnedConversationId = await sendMessage(messageToSend);
      }
      // If backend returned a conversation id and route doesn't match, navigate
      if (returnedConversationId && returnedConversationId !== conversationId) {
        navigate(`/c/${returnedConversationId}`);
      }
      // Proactively refresh turns so the new voice response appears without a full refresh
      try {
        const convoId = returnedConversationId || conversationId;
        if (convoId && convoId !== 'new') {
          const turns = await conversationService.listTurns(convoId, 200, 0);
          hydrateFromTurns(turns);
        }
      } catch (e) {
        console.error('post-stream hydrate failed', e);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Reset sending state on error
      setIsSendingMessage(false);
    }
  };

  // Hydrate messages when conversationId changes
  useEffect(() => {
    let isCancelled = false;
    const run = async () => {
      try {
        if (!conversationId || conversationId === 'new') {
          // fresh state for new
          clearMessages();
          return;
        }
        const turns = await conversationService.listTurns(conversationId, 200, 0);
        if (!isCancelled) {
          hydrateFromTurns(turns);
        }
      } catch (e) {
        console.error('Failed to hydrate conversation', e);
      }
    };
    run();
    return () => { isCancelled = true; };
  }, [conversationId, conversationService, hydrateFromTurns, clearMessages]);

  const overlayEnabled = process.env.REACT_APP_VOICE_OVERLAY_ENABLED === 'true';

  return (
    <div className="chat-container">
      <div className={`chat-content${overlayEnabled && isVoiceMode ? ' chat-blurred' : ''}`}>
        <ChatHeader
          onSettingsOpen={() => setIsSettingsOpen(true)}
          isSpeechRecognitionSupported={isSpeechRecognitionSupported}
          onHistoryToggle={() => setIsHistoryOpen(v => !v)}
        />
        {/* History Modal */}
        <HistoryDrawer
          isOpen={isHistoryOpen}
          conversations={conversations}
          isLoading={isHistoryLoading}
          onClose={() => setIsHistoryOpen(false)}
          onLoadMore={loadMore}
          hasMore={hasMore}
          onSelect={(id) => { navigate(`/c/${id}`); }}
          onRename={async (id, title) => { await renameConversation(id, title); await refreshList(); }}
        />

        {/* Main content area */}
        {(!overlayEnabled && isVoiceMode) ? (
          // Legacy voice mode replaces chat content when overlay is disabled
          <VoiceMode
            transcriptionText={transcriptionText}
            isSpeaking={isSpeaking}
            isRecording={isRecognitionRecording}
            isLoading={isLoading || isSendingMessage}
            onExit={exitVoiceMode}
            onSendMessage={() => handleSendMessage()}
          />
        ) : (
          // Normal chat view (or when overlay is active, we hide messages/input below via blur)
          <>
            <ChatMessages
              messages={messages}
              isLoading={isLoading}
            />
            <ChatInput
              onSendMessage={handleSendMessage}
              onVoiceActivate={toggleVoiceRecording}
              isLoading={isLoading}
              isRecording={isRecognitionRecording}
              isInCooldown={isInCooldown}
              isSpeechRecognitionSupported={isSpeechRecognitionSupported}
              microphonePermission={voiceState.microphonePermission}
            />
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

      {/* Overlay Voice Mode */}
      {overlayEnabled && isVoiceMode && (
        <VoiceMode
          transcriptionText={transcriptionText}
          isSpeaking={isSpeaking}
          isRecording={isRecognitionRecording}
          isLoading={isLoading || isSendingMessage}
          onExit={exitVoiceMode}
          onSendMessage={() => handleSendMessage()}
          overlay={true}
          contextMessages={messages.slice(-2)}
        />
      )}

      {/* No bottom fallback; legacy mode is rendered inside chat-content above */}
    </div>
  );
};

export default ChatInterface; 