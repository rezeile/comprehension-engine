import React from 'react';
// icons are handled in controls; no direct usage here
import VoiceStatusIndicator from './VoiceStatusIndicator';
import VoiceModeControls from './VoiceModeControls';
import AssistantBlock from '../ChatMessages/AssistantBlock';
import UserChip from '../ChatMessages/UserChip';
import { Message } from '../../types/chat.types';
import './VoiceMode.css';

interface VoiceModeProps {
  transcriptionText: string;
  isSpeaking: boolean;
  isRecording: boolean;
  isLoading: boolean;
  onExit: () => void;
  onSendMessage: () => void;
  overlay?: boolean;
  contextMessages?: Message[];
  
}

const VoiceMode: React.FC<VoiceModeProps> = ({
  transcriptionText,
  isSpeaking,
  isRecording,
  isLoading,
  onExit,
  onSendMessage,
  overlay = false,
  contextMessages = [],
  
}) => {
  return (
    <div className={`voice-mode-interface${overlay ? ' voice-overlay' : ''}`}>
      <div className="voice-mode-content">
        {overlay && contextMessages.length > 0 && (
          <div className="voice-context" aria-live="off">
            {contextMessages.map((m) => (
              m.sender === 'assistant' ? (
                <div key={m.id} className="voice-context-item">
                  <AssistantBlock content={m.content} timestamp={m.timestamp} />
                </div>
              ) : (
                <div key={m.id} className="voice-context-item">
                  <UserChip content={m.content} timestamp={m.timestamp} />
                </div>
              )
            ))}
          </div>
        )}
        <VoiceStatusIndicator
          isSpeaking={isSpeaking}
          isRecording={isRecording}
          isLoading={isLoading}
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
