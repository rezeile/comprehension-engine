import { useState, useCallback, useRef, useEffect } from 'react';
import { Message, ChatRequest, ChatResponse, ChatState, ChatOptions, SendMessageOptions } from '../types/chat.types';

export const useChat = (options: ChatOptions = {}) => {
  const {
    backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000',
    onMessageSent,
    onMessageReceived,
    onError
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
  const sendMessageToBackend = useCallback(async (message: string): Promise<string> => {
    try {
      // Prepare conversation history for the API
      const conversationHistory = state.messages.slice(1).map(msg => ({
        role: msg.sender as 'user' | 'assistant',
        content: msg.content
      }));

      const requestBody: ChatRequest = {
        message: message,
        conversation_history: conversationHistory
      };

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
      const errorMessage = error instanceof Error ? error.message : 'Failed to get response from AI tutor. Please try again.';
      throw new Error(errorMessage);
    }
  }, [state.messages, backendUrl]);

  // Send a message
  const sendMessage = useCallback(async (content: string, sender: 'user' | 'assistant' = 'user') => {
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
        const aiResponse = await sendMessageToBackend(message.content);
        
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
  }, [sendMessageToBackend, onMessageSent, onMessageReceived, onError]);

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
    sendMessageWithOptions,
    addMessage,
    updateMessage,
    deleteMessage,
    clearMessages,
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
