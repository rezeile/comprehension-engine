import React from 'react';
import { Voice } from '../../services/VoiceService';

interface VoiceStatusIndicatorProps {
  isSpeaking: boolean;
  isRecording: boolean;
  isLoading: boolean;
  selectedVoice: string;
  voices: Voice[];
}

const VoiceStatusIndicator: React.FC<VoiceStatusIndicatorProps> = ({
  isSpeaking,
  isRecording,
  isLoading,
  selectedVoice,
  voices
}) => {
  // Find the selected voice name
  const selectedVoiceData = voices.find(voice => voice.id === selectedVoice);
  const voiceName = selectedVoiceData?.name || 'Antoni'; // Fallback to Antoni if not found
  
  return (
    <div className="voice-status-display">
      <div className="voice-mode-indicator">
        {isLoading ? (
          <>
            <div className="mic-ring mic-ring--neutral" aria-hidden />
            <p>Thinking...</p>
          </>
        ) : isSpeaking ? (
          <>
            <div className="mic-ring mic-ring--ai" aria-hidden />
            <p>{voiceName} is speaking...</p>
          </>
        ) : (
          <>
            <div className="mic-ring mic-ring--user" aria-hidden />
            <p>Listening...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default VoiceStatusIndicator;
