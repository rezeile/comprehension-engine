import React from 'react';
import { CloseIcon, SendIcon } from '../Icons';
import VoiceStatusIndicator from './VoiceStatusIndicator';
import TranscriptionDisplay from './TranscriptionDisplay';
import VoiceModeControls from './VoiceModeControls';
import './VoiceMode.css';

interface VoiceModeProps {
  transcriptionText: string;
  isSpeaking: boolean;
  isRecording: boolean;
  isInCooldown: boolean;
  isAudioSettling: boolean;
  isLoading: boolean;
  forcedSilenceEndTime: number;
  onExit: () => void;
  onSendMessage: () => void;
  onForceActivate: () => void;
}

const VoiceMode: React.FC<VoiceModeProps> = ({
  transcriptionText,
  isSpeaking,
  isRecording,
  isInCooldown,
  isAudioSettling,
  isLoading,
  forcedSilenceEndTime,
  onExit,
  onSendMessage,
  onForceActivate
}) => {
  return (
    <div className="voice-mode-interface">
      <div className="voice-mode-content">
        <VoiceStatusIndicator
          isSpeaking={isSpeaking}
          isRecording={isRecording}
          isLoading={isLoading}
        />
        
        <TranscriptionDisplay
          transcriptionText={transcriptionText}
          isSpeaking={isSpeaking}
          isInCooldown={isInCooldown}
          isAudioSettling={isAudioSettling}
          isLoading={isLoading}
          forcedSilenceEndTime={forcedSilenceEndTime}
          onForceActivate={onForceActivate}
        />
      </div>
      
      <VoiceModeControls
        transcriptionText={transcriptionText}
        isLoading={isLoading}
        onExit={onExit}
        onSendMessage={onSendMessage}
      />
    </div>
  );
};

export default VoiceMode;
