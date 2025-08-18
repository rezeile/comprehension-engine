import React from 'react';
import { CloseIcon, SendIcon } from '../Icons';

interface VoiceModeControlsProps {
  transcriptionText: string;
  isLoading: boolean;
  onExit: () => void;
  onSendMessage: () => void;
}

const VoiceModeControls: React.FC<VoiceModeControlsProps> = ({
  transcriptionText,
  isLoading,
  onExit,
  onSendMessage
}) => {
  return (
    <div className="voice-controls">
      <button
        onClick={onExit}
        className="voice-control-btn close-btn"
        title="Exit voice mode"
      >
        <CloseIcon width={24} height={24} />
      </button>
      
      <button
        onClick={onSendMessage}
        disabled={!transcriptionText.replace(/\[interim\].*$/, '').trim() || isLoading}
        className="voice-control-btn send-btn"
        title="Send transcription"
      >
        <SendIcon width={24} height={24} />
      </button>
    </div>
  );
};

export default VoiceModeControls;
