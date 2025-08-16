import React from 'react';
import { SettingsIcon } from '../Icons';
import { useAuth } from '../../context/AuthContext';
import './ChatHeader.css';

interface ChatHeaderProps {
  onSettingsOpen: () => void;
  isSpeechRecognitionSupported: boolean;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  onSettingsOpen,
  isSpeechRecognitionSupported
}) => {
  const { user, logout } = useAuth();
  return (
    <div className="chat-header">
      <h1>Comprehension Engine</h1>
      <p>AI-Powered Learning Assistant</p>
      
      {/* Left controls (settings & notices) */}
      <div className="voice-controls-header">
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

      {/* Right controls (user info) */}
      <div className="user-controls-header">
        <div className="user-section">
          <span className="user-info">
            {user?.name || user?.email}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;
