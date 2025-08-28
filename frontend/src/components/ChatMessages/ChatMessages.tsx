import React, { useEffect, useRef } from 'react';
import FormattedMessage from '../FormattedMessage';
import AssistantBlock from './AssistantBlock';
import UserChip from './UserChip';
import './ChatMessages.css';

type Attachment = {
  id: string;
  type: 'image';
  url: string;
  width?: number;
  height?: number;
  alt?: string;
};

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  attachments?: Attachment[];
}

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
}

const ChatMessages: React.FC<ChatMessagesProps> = ({ messages, isLoading }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="messages-container">
      <div className="messages-column">
        {messages.map((message, idx) => (
          <div
            key={message.id}
            className={`message ${message.sender === 'user' ? 'user-message' : 'assistant-message'}`}
          >
            {message.sender === 'assistant' ? (
              <AssistantBlock 
                content={message.content} 
                timestamp={message.timestamp} 
                attachments={message.attachments}
                hideCopy={idx === 0}
              />
            ) : (
              <UserChip content={message.content} timestamp={message.timestamp} attachments={message.attachments} />
            )}
          </div>
        ))}

        {isLoading && (
          <div className="message assistant-message">
            <div className="assistant-block">
              <div className="assistant-block__content">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Keep the scroll sentinel at the very bottom of the column */}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default ChatMessages;
