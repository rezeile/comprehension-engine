import React from 'react';
import VoiceSelector from './VoiceSelector';
import { Voice } from '../services/VoiceService';
import './SettingsPanel.css';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVoice: string;
  onVoiceChange: (voiceId: string) => void;
  voices: Voice[];
  voiceEnabled: boolean;
  onVoiceToggle: () => void;
  onClearSpokenMessages?: () => void;
  onGetSpokenMessageStatus?: () => any;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  selectedVoice,
  onVoiceChange,
  voices,
  voiceEnabled,
  onVoiceToggle,
  onClearSpokenMessages = () => {},
  onGetSpokenMessageStatus = () => {}
}) => {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div className="settings-backdrop" onClick={onClose} />
      )}
      
      {/* Settings Panel */}
      <div className={`settings-panel ${isOpen ? 'open' : ''}`}>
        <div className="settings-header">
          <h3>Settings</h3>
          <button 
            className="settings-close-btn"
            onClick={onClose}
            aria-label="Close settings"
          >
            ×
          </button>
        </div>
        
        <div className="settings-content">
          {/* Voice Settings Section */}
          <div className="settings-section">
            <h4>Voice Settings</h4>
            
            {/* Voice Toggle */}
            <div className="setting-item">
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={voiceEnabled}
                  onChange={onVoiceToggle}
                  className="setting-checkbox"
                />
                Enable Voice Output
              </label>
            </div>
            
            {/* Voice Selector */}
            {voiceEnabled && voices.length > 0 && (
              <div className="setting-item">
                <VoiceSelector
                  selectedVoice={selectedVoice}
                  onVoiceChange={onVoiceChange}
                  voices={voices}
                />
              </div>
            )}
          </div>
          
          {/* About Section */}
          <div className="settings-section">
            <h4>About</h4>
            <p className="settings-about">
              This app uses ElevenLabs AI voices for natural, human-like speech synthesis.
            </p>
          </div>
          
          {/* Debug Section */}
          {process.env.NODE_ENV === 'development' && (
            <div className="settings-section">
              <h4>Debug</h4>
              <div className="setting-item">
                <button
                  className="debug-btn"
                  onClick={onGetSpokenMessageStatus}
                  type="button"
                >
                  Show Spoken Message Status
                </button>
              </div>
              <div className="setting-item">
                <button
                  className="debug-btn danger"
                  onClick={onClearSpokenMessages}
                  type="button"
                >
                  Clear Spoken Message History
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SettingsPanel;
