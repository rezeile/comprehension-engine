import React from 'react';

interface VoiceStatusIndicatorProps {
  isSpeaking: boolean;
  isRecording: boolean;
  isLoading: boolean;
}

const VoiceStatusIndicator: React.FC<VoiceStatusIndicatorProps> = ({
  isSpeaking,
  isRecording,
  isLoading
}) => {
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
            <p>Antoni is speaking...</p>
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
