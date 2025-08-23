import { useState, useCallback, useRef, useEffect } from 'react';
import { Message, ChatRequest, ChatResponse, ChatState, ChatOptions, SendMessageOptions } from '../types/chat.types';
import { ConversationTurn } from '../types/conversation.types';

export const useChat = (options: ChatOptions = {}) => {
  const {
    backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000',
    onMessageSent,
    onMessageReceived,
    onError,
    conversationId,
    onStreamSentence,
    onStreamSentenceWithIndex,
    onStreamStart,
    onStreamDone,
  } = options;

  // State management
  const [state, setState] = useState<ChatState>({
    messages: [
      {
        id: '1',
        content: 'Hello! I\'m your AI tutor. How can I help you learn today?',
        sender: 'assistant',
        timestamp: new Date()
      }
    ],
    isLoading: false,
    isStreaming: false,
    error: null
  });

  // Ref for auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [state.messages, scrollToBottom]);

  // Send message to backend
  const sendMessageToBackend = useCallback(async (message: string): Promise<{ ai: string; conversationId?: string }> => {
    try {
      // Prepare conversation history for the API
      const conversationHistory = state.messages.slice(1).map(msg => ({
        role: msg.sender as 'user' | 'assistant',
        content: msg.content
      }));

      const requestBody: ChatRequest = {
        message: message,
        conversation_history: conversationHistory,
        ...(
          conversationId && conversationId !== 'new'
            ? { conversation_id: conversationId }
            : { start_new: true }
        ),
      };

      const accessToken = localStorage.getItem('access_token');
      const response = await fetch(`${backendUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ChatResponse = await response.json();
      return { ai: data.response, conversationId: data.conversation_id };
    } catch (error) {
      console.error('Error sending message to backend:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to get response from AI tutor. Please try again.';
      throw new Error(errorMessage);
    }
  }, [state.messages, backendUrl, conversationId]);

  // Send a message
  const sendMessage = useCallback(async (content: string, sender: 'user' | 'assistant' = 'user'): Promise<string | undefined> => {
    if (!content.trim()) return;

    const message: Message = {
      id: Date.now().toString(),
      content: content.trim(),
      sender,
      timestamp: new Date()
    };

    // Add user message immediately
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, message],
      error: null
    }));

    onMessageSent?.(message);

    // If it's a user message, get AI response
    if (sender === 'user') {
      setState(prev => ({ ...prev, isLoading: true }));

      try {
        const { ai: aiResponse, conversationId: returnedConversationId } = await sendMessageToBackend(message.content);
        
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: aiResponse,
          sender: 'assistant',
          timestamp: new Date()
        };
        
        setState(prev => ({
          ...prev,
          messages: [...prev.messages, assistantMessage],
          isLoading: false
        }));

        onMessageReceived?.(assistantMessage);

        return returnedConversationId;
      } catch (error) {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.',
          sender: 'assistant',
          timestamp: new Date()
        };
        
        setState(prev => ({
          ...prev,
          messages: [...prev.messages, errorMessage],
          isLoading: false,
          error: errorMessage.content
        }));

        onError?.(errorMessage.content);
      }
    }
    return undefined;
  }, [sendMessageToBackend, onMessageSent, onMessageReceived, onError]);

  // Streaming: send message and consume /api/chat/stream (SSE)
  const sendMessageStreamed = useCallback(async (content: string): Promise<string | undefined> => {
    const messageText = content.trim();
    if (!messageText) return;

    // Push user message immediately
    const userMsg: Message = {
      id: Date.now().toString(),
      content: messageText,
      sender: 'user',
      timestamp: new Date()
    };
    setState(prev => ({ ...prev, messages: [...prev.messages, userMsg], isLoading: true, isStreaming: true, error: null }));
    onMessageSent?.(userMsg);
    onStreamStart?.();

    // Prepare streaming assistant message
    const assistantId = (Date.now() + 1).toString();
    let currentAssistantText = '';
    let ttsBuffer = '';

    const appendAssistant = (delta: string) => {
      currentAssistantText += delta;
      setState(prev => ({
        ...prev,
        messages: prev.messages.some(m => m.id === assistantId)
          ? prev.messages.map(m => m.id === assistantId ? { ...m, content: currentAssistantText } : m)
          : [...prev.messages, { id: assistantId, content: currentAssistantText, sender: 'assistant', timestamp: new Date() }]
      }));
    };

    try {
      const ttsDebug = process.env.REACT_APP_TTS_TIMING_DEBUG === 'true';
      const turnStartTs = Date.now();
      let sentenceIndex = 0;
      if (ttsDebug) {
        // eslint-disable-next-line no-console
        console.groupCollapsed(`[TTS] Turn start ${new Date(turnStartTs).toISOString()}`);
      }
      // Build request body
      const conversationHistory = state.messages.slice(1).map(msg => ({ role: msg.sender as 'user' | 'assistant', content: msg.content }));
      const requestBody: ChatRequest = {
        message: messageText,
        conversation_history: conversationHistory,
        ...(conversationId && conversationId !== 'new' ? { conversation_id: conversationId } : { start_new: true }),
      };

      const accessToken = localStorage.getItem('access_token');
      const res = await fetch(`${backendUrl}/api/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(requestBody),
      });

      if (!res.ok || !res.body) {
        throw new Error(`SSE request failed: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      const readLoop = async () => {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          if (ttsDebug) {
            // eslint-disable-next-line no-console
            console.log('[TTS] delta bytes', { len: value?.byteLength ?? 0, ts: Date.now() });
          }
          const lines = chunk.split(/\n\n/);
          for (const block of lines) {
            const line = block.trim();
            if (!line.startsWith('data:')) continue;
            const dataStr = line.replace(/^data:\s*/, '');
            try {
              const data = JSON.parse(dataStr);
              if (typeof data.delta === 'string' && data.delta.length > 0) {
                appendAssistant(data.delta);
                // Sentence boundary detection with precise remainder tracking
                ttsBuffer += data.delta;
                const re = /([\s\S]*?[.!?])\s+/g;
                let lastProcessedIndex = 0;
                let match: RegExpExecArray | null;
                while ((match = re.exec(ttsBuffer)) !== null) {
                  const sentence = match[1];
                  if (sentence && sentence.trim().length > 0) {
                    if (ttsDebug) {
                      // eslint-disable-next-line no-console
                      console.log('[TTS] emit sentence', { idx: sentenceIndex, chars: sentence.length, ts: Date.now(), sample: sentence.slice(0, 60) });
                    }
                    onStreamSentenceWithIndex?.(sentence, sentenceIndex);
                    if (!onStreamSentenceWithIndex) {
                      onStreamSentence?.(sentence);
                    }
                    sentenceIndex += 1;
                  }
                  lastProcessedIndex = re.lastIndex;
                }
                if (lastProcessedIndex > 0) {
                  ttsBuffer = ttsBuffer.slice(lastProcessedIndex);
                }
              }
              if (data.done) {
                // Flush any remaining text as one last sentence
                if (ttsBuffer.trim().length > 0) {
                  const flush = ttsBuffer.trim();
                  if (ttsDebug) {
                    // eslint-disable-next-line no-console
                    console.log('[TTS] flush tail sentence', { idx: sentenceIndex, chars: flush.length, ts: Date.now(), sample: flush.slice(0, 60) });
                  }
                  onStreamSentenceWithIndex?.(flush, sentenceIndex);
                  if (!onStreamSentenceWithIndex) {
                    onStreamSentence?.(flush);
                  }
                  sentenceIndex += 1;
                  ttsBuffer = '';
                }
                break;
              }
            } catch {
              // ignore malformed JSON
            }
          }
        }
      };

      await readLoop();

      setState(prev => ({ ...prev, isLoading: false, isStreaming: false }));
      onMessageReceived?.({ id: assistantId, content: currentAssistantText, sender: 'assistant', timestamp: new Date() });
      onStreamDone?.();
      if (ttsDebug) {
        // eslint-disable-next-line no-console
        console.log('[TTS] turn done', { totalChars: currentAssistantText.length, sentences: sentenceIndex, ms: Date.now() - turnStartTs });
        // eslint-disable-next-line no-console
        console.groupEnd();
      }
      return conversationId;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Streaming failed';
      setState(prev => ({ ...prev, isLoading: false, isStreaming: false, error: errMsg }));
      onError?.(errMsg);
      onStreamDone?.();
      const ttsDebug = process.env.REACT_APP_TTS_TIMING_DEBUG === 'true';
      if (ttsDebug) {
        // eslint-disable-next-line no-console
        console.log('[TTS] turn error', { err: errMsg, ts: Date.now() });
        // eslint-disable-next-line no-console
        console.groupEnd?.();
      }
      return undefined;
    }
  }, [backendUrl, conversationId, onError, onMessageReceived, onMessageSent, onStreamSentence, onStreamSentenceWithIndex, onStreamStart, onStreamDone, state.messages]);

  // Send message with options
  const sendMessageWithOptions = useCallback(async (options: SendMessageOptions) => {
    const { content, sender, autoScroll = true } = options;
    await sendMessage(content, sender);
    
    if (autoScroll) {
      setTimeout(scrollToBottom, 100);
    }
  }, [sendMessage, scrollToBottom]);

  // Add message directly (for external sources)
  const addMessage = useCallback((message: Message) => {
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, message]
    }));
  }, []);

  // Update message
  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    setState(prev => ({
      ...prev,
      messages: prev.messages.map(msg => 
        msg.id === id ? { ...msg, ...updates } : msg
      )
    }));
  }, []);

  // Delete message
  const deleteMessage = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      messages: prev.messages.filter(msg => msg.id !== id)
    }));
  }, []);

  // Clear all messages
  const clearMessages = useCallback(() => {
    setState(prev => ({
      ...prev,
      messages: [
        {
          id: '1',
          content: 'Hello! I\'m your AI tutor. How can I help you learn today?',
          sender: 'assistant',
          timestamp: new Date()
        }
      ],
      error: null
    }));
  }, []);

  // Hydrate messages from a list of conversation turns
  const hydrateFromTurns = useCallback((turns: ConversationTurn[]) => {
    const hydrated: Message[] = [
      {
        id: '1',
        content: 'Hello! I\'m your AI tutor. How can I help you learn today?',
        sender: 'assistant',
        timestamp: new Date()
      }
    ];
    for (const t of turns) {
      hydrated.push({
        id: `${t.id}-u`,
        content: t.user_input,
        sender: 'user',
        timestamp: t.timestamp ? new Date(t.timestamp) : new Date()
      });
      hydrated.push({
        id: `${t.id}-a`,
        content: t.ai_response,
        sender: 'assistant',
        timestamp: t.timestamp ? new Date(t.timestamp) : new Date()
      });
    }
    setState(prev => ({ ...prev, messages: hydrated, error: null }));
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Get conversation history
  const getConversationHistory = useCallback(() => {
    return state.messages.slice(1); // Skip welcome message
  }, [state.messages]);

  // Get last message
  const getLastMessage = useCallback(() => {
    return state.messages[state.messages.length - 1];
  }, [state.messages]);

  // Check if conversation is empty (only welcome message)
  const isConversationEmpty = useCallback(() => {
    return state.messages.length <= 1;
  }, [state.messages]);

  return {
    // State
    ...state,
    
    // Actions
    sendMessage,
    sendMessageStreamed,
    sendMessageWithOptions,
    addMessage,
    updateMessage,
    deleteMessage,
    clearMessages,
    hydrateFromTurns,
    clearError,
    
    // Utilities
    scrollToBottom,
    getConversationHistory,
    getLastMessage,
    isConversationEmpty,
    
    // Refs
    messagesEndRef
  };
};
