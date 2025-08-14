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
            <div className="speaking-waves">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </div>
            <p>Just a sec... sending message</p>
          </>
        ) : isSpeaking ? (
          <>
            <div className="speaking-waves">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </div>
            <p>Antoni is speaking...</p>
          </>
        ) : (
          // Show waves for any listening state (including when first entering voice mode)
          <>
            <div className="speaking-waves">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </div>
            <p>Start speaking...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default VoiceStatusIndicator;
