import React from 'react';

interface MessageMetaProps {
  timestamp: Date;
  className?: string;
  align?: 'left' | 'right';
}

const MessageMeta: React.FC<MessageMetaProps> = ({ timestamp, className = '', align = 'left' }) => {
  return (
    <div className={`${className}`} style={{ textAlign: align }}>
      {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </div>
  );
};

export default MessageMeta;


