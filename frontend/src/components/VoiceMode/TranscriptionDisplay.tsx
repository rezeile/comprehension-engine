import React from 'react';

interface TranscriptionDisplayProps {
  transcriptionText: string;
  isSpeaking: boolean;
  isInCooldown: boolean;
  isAudioSettling: boolean;
  isLoading: boolean;
  forcedSilenceEndTime: number;
  onForceActivate: () => void;
}

const TranscriptionDisplay: React.FC<TranscriptionDisplayProps> = ({
  transcriptionText,
  isSpeaking,
  isInCooldown,
  isAudioSettling,
  isLoading,
  forcedSilenceEndTime,
  onForceActivate
}) => {
  return (
    <div className="transcription-feedback">
      <div className="transcription-display">
        {isLoading ? (
          // Show "sending message" state
          <div className="transcription-textarea" style={{ color: 'rgba(255, 255, 255, 0.7)', fontStyle: 'italic', textAlign: 'center' }}>
            Just a sec... sending message
          </div>
        ) : isSpeaking ? (
          // Show status when AI is speaking
          <div className="transcription-textarea" style={{ color: 'rgba(255, 255, 255, 0.7)', fontStyle: 'italic', textAlign: 'center' }}>
            AI is speaking... Please wait
          </div>
        ) : isInCooldown ? (
          // Show cooldown message
          <div className="transcription-textarea" style={{ color: 'rgba(255, 193, 7, 0.8)', fontStyle: 'italic', textAlign: 'center' }}>
            {Date.now() < forcedSilenceEndTime ? (
              `Preventing echo... ${Math.ceil((forcedSilenceEndTime - Date.now()) / 1000)}s remaining`
            ) : (
              'Audio settling... Please wait'
            )}
            <br />
            <small style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px', display: 'block' }}>
              Compensating for speech synthesis audio lag
            </small>
            <button 
              onClick={onForceActivate}
              className="force-activate-btn"
              style={{ 
                marginTop: '8px', 
                padding: '4px 8px', 
                fontSize: '12px',
                backgroundColor: 'rgba(76, 175, 80, 0.8)',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              Force Activate Microphone
            </button>
          </div>
        ) : isAudioSettling ? (
          // Show waiting message
          <div className="transcription-textarea" style={{ color: 'rgba(255, 255, 255, 0.6)', fontStyle: 'italic', textAlign: 'center' }}>
            Audio settling... Ready in a moment
          </div>
        ) : transcriptionText ? (
          // Show transcription text when user is speaking
          <div className="transcription-textarea">
            {transcriptionText.replace(/\[interim\].*$/, '')}
            {transcriptionText.includes('[interim]') && (
              <span className="interim-text">
                {transcriptionText.split('[interim]')[1]}
              </span>
            )}
          </div>
        ) : (
          // Empty state: rely on CSS placeholder (:empty::before)
          <div className="transcription-textarea" />
        )}
      </div>
    </div>
  );
};

export default TranscriptionDisplay;
