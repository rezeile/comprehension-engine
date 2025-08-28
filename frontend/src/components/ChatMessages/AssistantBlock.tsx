import React, { useState } from 'react';
import FormattedMessage from '../FormattedMessage';
import { CopyIcon, CheckIcon } from '../Icons';
// Removed timestamp meta for assistant messages

type Attachment = {
  id: string;
  type: 'image';
  url: string;
  width?: number;
  height?: number;
  alt?: string;
};

interface AssistantBlockProps {
  content: string;
  timestamp: Date;
  attachments?: Attachment[];
}

const AssistantBlock: React.FC<AssistantBlockProps> = ({ content, attachments, timestamp: _timestamp }) => {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea');
        textArea.value = content;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      } catch (_) {
        // no-op
      }
    }
  };
  return (
    <div className="assistant-block">
      <div className="assistant-block__actions">
        <button
          type="button"
          className={`copy-response-btn ${copied ? 'copied' : ''}`}
          aria-label={copied ? 'Copied' : 'Copy response'}
          title={copied ? 'Copied!' : 'Copy response'}
          onClick={handleCopy}
        >
          {copied ? <CheckIcon width={16} height={16} /> : <CopyIcon width={16} height={16} />}
        </button>
      </div>
      <div className="assistant-block__content">
        <FormattedMessage content={content} className="assistant" variant="lecture" />
        {attachments && attachments.length > 0 && (
          <div className="attachments-grid" style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px' }}>
            {attachments.map(att => (
              <button key={att.id} onClick={() => setLightboxUrl(att.url)} title={att.alt || 'attachment'} style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <img src={att.url} alt={att.alt || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-subtle)' }} />
              </button>
            ))}
          </div>
        )}
      </div>
      {lightboxUrl && (
        <div role="dialog" aria-modal="true" onClick={() => setLightboxUrl(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <img src={lightboxUrl} alt="attachment" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, boxShadow: '0 10px 40px rgba(0,0,0,0.6)' }} />
        </div>
      )}
    </div>
  );
};

export default AssistantBlock;


