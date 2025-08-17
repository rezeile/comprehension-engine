import React from 'react';
import { Voice } from '../services/VoiceService';
import './VoiceSelector.css';

interface VoiceSelectorProps {
  selectedVoice: string;
  onVoiceChange: (voiceId: string) => void;
  voices: Voice[];
  disabled?: boolean;
}

const VoiceSelector: React.FC<VoiceSelectorProps> = ({ 
  selectedVoice, 
  onVoiceChange, 
  voices, 
  disabled = false 
}) => {
  const selectedVoiceData = voices.find(v => v.id === selectedVoice);
  
  return (
    <div className="voice-selector">
      <select
        id="voice-select"
        value={selectedVoice}
        onChange={(e) => onVoiceChange(e.target.value)}
        disabled={disabled}
        className="voice-selector-dropdown"
        title={selectedVoiceData ? `${selectedVoiceData.name} - ${selectedVoiceData.description}` : ''}
      >
        {voices.map(voice => (
          <option key={voice.id} value={voice.id} title={`${voice.name} - ${voice.description}`}>
            {voice.name} - {voice.description}
          </option>
        ))}
      </select>
    </div>
  );
};

export default VoiceSelector;
