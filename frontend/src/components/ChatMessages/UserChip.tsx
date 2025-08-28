import React from 'react';
import FormattedMessage from '../FormattedMessage';

type Attachment = {
  id: string;
  type: 'image';
  url: string;
  width?: number;
  height?: number;
  alt?: string;
};

interface UserChipProps {
  content: string;
  timestamp: Date;
  attachments?: Attachment[];
}

const UserChip: React.FC<UserChipProps> = ({ content, attachments, timestamp: _timestamp }) => {
  return (
    <div className="user-chip">
      <div className="user-chip__content">
        <FormattedMessage content={content} className="user" />
        {attachments && attachments.length > 0 && (
          <div className="attachments-grid" style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {attachments.map(att => (
              <a key={att.id} href={att.url} target="_blank" rel="noreferrer" title={att.alt || 'attachment'}>
                <img src={att.url} alt={att.alt || ''} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-subtle)' }} />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserChip;


