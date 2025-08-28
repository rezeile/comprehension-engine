import React from 'react';
import { SettingsIcon } from '../Icons';
import Icons from '../Icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './ChatHeader.css';

interface ChatHeaderProps {
  onSettingsOpen: () => void;
  isSpeechRecognitionSupported: boolean;
  onHistoryToggle?: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  onSettingsOpen,
  isSpeechRecognitionSupported,
  onHistoryToggle
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="chat-header">
      <h1>GraspWell</h1>
      <p>Your learning companion</p>
      
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
        {onHistoryToggle && (
          <button
            onClick={onHistoryToggle}
            className="settings-gear"
            title="Open history"
            aria-label="Open history"
            aria-controls="history-drawer"
          >
            <Icons.History width={20} height={20} />
          </button>
        )}
        <button
          onClick={() => navigate('/c/new')}
          className="new-chat-button"
          title="Start a new chat"
          aria-label="Start a new chat"
        >
          <Icons.Plus width={20} height={20} />
        </button>
        {!isSpeechRecognitionSupported && (
          <span className="compatibility-warning">Voice input not supported in this browser</span>
        )}
      </div>

      {/* Right controls (user info) */}
      {/* <div className="user-controls-header">
        <div className="user-section">
          <img src="@1024.png" alt="User avatar" className="user-avatar" />
        </div>
      </div> */}
    </div>
  );
};

export default ChatHeader;
