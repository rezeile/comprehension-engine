import React from 'react';
import { SpeakerIcon, SettingsIcon } from '../Icons';
import './ChatHeader.css';

interface ChatHeaderProps {
  voiceEnabled: boolean;
  isSpeaking: boolean;
  onVoiceToggle: () => void;
  onSettingsOpen: () => void;
  isSpeechRecognitionSupported: boolean;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  voiceEnabled,
  isSpeaking,
  onVoiceToggle,
  onSettingsOpen,
  isSpeechRecognitionSupported
}) => {
  return (
    <div className="chat-header">
      <h1>Comprehension Engine</h1>
      <p>AI-Powered Learning Assistant</p>
      
      <div className="voice-controls-header">
        <button
          onClick={onVoiceToggle}
          className={`voice-toggle ${voiceEnabled ? 'enabled' : 'disabled'} ${isSpeaking ? 'speaking' : ''}`}
          title={voiceEnabled ? 'Disable voice output' : 'Enable voice output'}
        >
          <SpeakerIcon width={20} height={20} />
        </button>
        
        {/* Settings Gear Icon */}
        <button
          onClick={onSettingsOpen}
          className="settings-gear"
          title="Open settings"
          aria-label="Open settings"
        >
          <SettingsIcon width={20} height={20} />
        </button>
        
        {!isSpeechRecognitionSupported && (
          <span className="compatibility-warning">Voice input not supported in this browser</span>
        )}
      </div>
    </div>
  );
};

export default ChatHeader;
