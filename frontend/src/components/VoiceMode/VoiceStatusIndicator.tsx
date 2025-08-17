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
        ) : (
          // Listening (user speaking): single bar waveform
          <div className="mic-single-wave" aria-hidden>
            <span></span>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceStatusIndicator;
