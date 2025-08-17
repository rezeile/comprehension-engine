// Chat-related interfaces and types for the chat system

export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

export interface ChatRequest {
  message: string;
  conversation_history: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  conversation_id?: string;
  start_new?: boolean;
}

export interface ChatResponse {
  response: string;
  conversation_id?: string;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}

export interface ChatOptions {
  backendUrl?: string;
  onMessageSent?: (message: Message) => void;
  onMessageReceived?: (message: Message) => void;
  onError?: (error: string) => void;
  conversationId?: string;
}

export interface SendMessageOptions {
  content: string;
  sender: 'user' | 'assistant';
  autoScroll?: boolean;
}
