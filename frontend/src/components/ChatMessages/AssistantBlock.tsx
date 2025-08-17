import React from 'react';
import FormattedMessage from '../FormattedMessage';
// Removed timestamp meta for assistant messages

interface AssistantBlockProps {
  content: string;
  timestamp: Date;
}

const AssistantBlock: React.FC<AssistantBlockProps> = ({ content, timestamp: _timestamp }) => {
  return (
    <div className="assistant-block">
      <div className="assistant-block__content">
        <FormattedMessage content={content} className="assistant" variant="lecture" />
      </div>
      {/* Timestamp intentionally omitted for assistant messages */}
    </div>
  );
};

export default AssistantBlock;


