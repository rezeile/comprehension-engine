import React from 'react';
import SlidePanel from './SlidePanel/SlidePanel';
import { useAuth } from '../context/AuthContext';
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
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  selectedVoice,
  onVoiceChange,
  voices,
  voiceEnabled,
  onVoiceToggle
}) => {
  const { logout } = useAuth();
  return (
    <SlidePanel isOpen={isOpen} onClose={onClose} title="Settings" id="settings-panel">
        <div className="settings-content">
          {/* Voice Settings Section */}
          <div className="settings-section">
            <h4 className="settings-title settings-title--divider">Voice Settings</h4>
            
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
          </div>

          {/* AI Voice Section */}
          {voiceEnabled && voices.length > 0 && (
            <div className="settings-section">
              <h4 className="settings-title settings-title--divider">AI Voice</h4>
              <div className="setting-item">
                <VoiceSelector
                  selectedVoice={selectedVoice}
                  onVoiceChange={onVoiceChange}
                  voices={voices}
                />
              </div>
            </div>
          )}
          
          {/* About Section */}
          <div className="settings-section">
            <h4 className="settings-title settings-title--divider">About</h4>
            <p className="settings-about">
              This app uses ElevenLabs AI voices for natural, human-like speech synthesis.
            </p>
          </div>
          
          {/* Account Actions */}
          <div className="settings-section">
            <div className="setting-item">
              <button
                className="debug-btn danger"
                onClick={logout}
                type="button"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
    </SlidePanel>
  );
};

export default SettingsPanel;
