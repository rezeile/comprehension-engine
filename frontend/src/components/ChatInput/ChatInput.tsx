import React, { useState } from 'react';
import { MicrophoneIcon, SendIcon } from '../Icons';
import './ChatInput.css';

type Attachment = {
  id: string;
  type: 'image';
  url: string;
  width?: number;
  height?: number;
  alt?: string;
};

interface ChatInputProps {
  onSendMessage: (message: string, attachments?: Attachment[]) => void;
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
  const [localAttachments, setLocalAttachments] = useState<Attachment[]>([]);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const pickFiles = () => fileInputRef.current?.click();

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const accepted = ['image/png', 'image/jpeg', 'image/webp', 'image/heic'];
    const next: Attachment[] = [];
    for (const f of Array.from(files)) {
      if (!accepted.includes(f.type)) continue;
      // Show a local preview instantly using object URL; UploadService will replace URL after upload
      const tempId = `${Date.now()}-${f.name}`;
      const url = URL.createObjectURL(f);
      next.push({ id: tempId, type: 'image', url, alt: f.name });
    }
    if (next.length) setLocalAttachments(prev => [...prev, ...next]);
  };

  const handlePaste: React.ClipboardEventHandler<HTMLTextAreaElement> = (e) => {
    const files = e.clipboardData?.files;
    if (files && files.length > 0) {
      e.preventDefault();
      void handleFiles(files);
    }
  };

  const handleDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    void handleFiles(e.dataTransfer?.files || null);
  };

  const handleDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
  };

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
      onSendMessage(trimmedMessage, localAttachments);
      setInputValue('');
      setLocalAttachments([]);
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
      <div className="input-wrapper" onDrop={handleDrop} onDragOver={handleDragOver}>
        <textarea
          value={inputValue}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          onPaste={handlePaste}
          placeholder="Type your message here... (or click mic to start voice input)"
          disabled={isLoading}
          rows={1}
          className="message-input"
        />

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />

        {/* Thumbnails */}
        {localAttachments.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '6px' }}>
            {localAttachments.map(att => (
              <div key={att.id} style={{ position: 'relative' }}>
                <img src={att.url} alt={att.alt || ''} style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border-subtle)' }} />
              </div>
            ))}
          </div>
        )}
        
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

        {/* Attach/paperclip using SendIcon for now (no dedicated asset) */}
        <button
          onClick={pickFiles}
          className="pick-files-button"
          title="Attach images"
          type="button"
        >
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.64 16.2a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
          </svg>
        </button>
        
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
