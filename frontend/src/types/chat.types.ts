// Chat-related interfaces and types for the chat system

export interface Attachment {
  id: string;
  type: 'image';
  url: string;
  width?: number;
  height?: number;
  alt?: string;
}

export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  attachments?: Attachment[];
}

export interface ChatRequest {
  message: string;
  conversation_history: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  conversation_id?: string;
  start_new?: boolean;
  attachments?: Attachment[];
}

export interface ChatResponse {
  response: string;
  conversation_id?: string;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  // True while an SSE streaming session is active
  isStreaming?: boolean;
  error: string | null;
}

export interface ChatOptions {
  backendUrl?: string;
  onMessageSent?: (message: Message) => void;
  onMessageReceived?: (message: Message) => void;
  onError?: (error: string) => void;
  conversationId?: string;
  // Streaming callbacks (SSE)
  onStreamSentence?: (sentence: string) => void;
  onStreamSentenceWithIndex?: (sentence: string, index: number) => void;
  onStreamStart?: () => void;
  onStreamDone?: () => void;
}

export interface SendMessageOptions {
  content: string;
  sender: 'user' | 'assistant';
  autoScroll?: boolean;
}
