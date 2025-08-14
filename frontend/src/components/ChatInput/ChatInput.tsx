import React, { useState } from 'react';
import { MicrophoneIcon, SendIcon } from '../Icons';
import './ChatInput.css';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  onVoiceActivate: () => void;
  isLoading: boolean;
  isRecording: boolean;
  isInCooldown: boolean;
  isSpeechRecognitionSupported: boolean;
  microphonePermission: 'granted' | 'denied' | 'prompt';
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onVoiceActivate,
  isLoading,
  isRecording,
  isInCooldown,
  isSpeechRecognitionSupported,
  microphonePermission
}) => {
  const [inputValue, setInputValue] = useState('');

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    } else if (e.code === 'Space' && !e.shiftKey && !inputValue.trim()) {
      // Only intercept Spacebar for voice input when text input is empty
      e.preventDefault();
      onVoiceActivate();
    }
    // Allow Spacebar to work normally when typing
  };

  const handleSendMessage = () => {
    const trimmedMessage = inputValue.trim();
    if (trimmedMessage && !isLoading) {
      onSendMessage(trimmedMessage);
      setInputValue('');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  };

  const handleVoiceActivate = () => {
    if (isInCooldown) {
      return;
    }
    
    if (!isSpeechRecognitionSupported) {
      return;
    }
    
    onVoiceActivate();
  };

  return (
    <div className="input-container">
      <div className="input-wrapper">
        <textarea
          value={inputValue}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder="Type your message here... (or click mic to start voice input)"
          disabled={isLoading}
          rows={1}
          className="message-input"
        />
        
        {/* Voice Input Button */}
        {isSpeechRecognitionSupported && (
          <button
            onClick={handleVoiceActivate}
            className={`voice-input-button ${isRecording ? 'recording' : ''} ${isInCooldown ? 'cooldown' : ''}`}
            disabled={isInCooldown}
            title={isInCooldown ? 'Microphone cooling down...' : isRecording ? 'Stop recording' : 'Start recording'}
          >
            {isRecording ? (
              // Recording state - pulsing microphone
              <MicrophoneIcon width={20} height={20} className="recording-animation" />
            ) : (
              // Idle state - regular microphone
              <MicrophoneIcon width={20} height={20} />
            )}
          </button>
        )}
        
        <button
          onClick={handleSendMessage}
          disabled={!inputValue.trim() || isLoading}
          className="send-button"
        >
          <SendIcon width={20} height={20} />
        </button>
      </div>
      
      {/* Microphone Permission Warning */}
      {microphonePermission === 'denied' && (
        <div className="permission-warning">
          <span>🎤 Microphone access denied. Please enable it in your browser settings to use voice input.</span>
        </div>
      )}
    </div>
  );
};

export default ChatInput;
