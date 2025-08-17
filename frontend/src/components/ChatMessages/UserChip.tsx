import React from 'react';
import FormattedMessage from '../FormattedMessage';

interface UserChipProps {
  content: string;
  timestamp: Date;
}

const UserChip: React.FC<UserChipProps> = ({ content, timestamp: _timestamp }) => {
  return (
    <div className="user-chip">
      <div className="user-chip__content">
        <FormattedMessage content={content} className="user" />
      </div>
    </div>
  );
};

export default UserChip;


