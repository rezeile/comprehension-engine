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
            <p>Just a sec... sending message</p>
          </>
        ) : isSpeaking ? (
          <>
            <div className="mic-ring mic-ring--ai" aria-hidden />
            <p>Antoni is speaking...</p>
          </>
        ) : isRecording ? (
          <>
            <div className="mic-ring mic-ring--user" aria-hidden />
            <p>Listening...</p>
          </>
        ) : (
          <>
            <div className="mic-ring mic-ring--neutral" aria-hidden />
            <p>Ready</p>
          </>
        )}
      </div>
    </div>
  );
};

export default VoiceStatusIndicator;
