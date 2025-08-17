import React, { useMemo, useState } from 'react';
import './HistoryDrawer.css';
import SlidePanel from '../SlidePanel/SlidePanel';
import { ConversationSummary } from '../../types/conversation.types';

interface HistoryDrawerProps {
  isOpen: boolean;
  conversations: ConversationSummary[];
  isLoading: boolean;
  onClose: () => void;
  onLoadMore: () => void;
  hasMore: boolean;
  onSelect: (id: string) => void;
  onRename?: (id: string, newTitle: string) => Promise<void> | void;
}

const fallbackTitle = (c: ConversationSummary) => c.title?.trim() || 'New Chat';

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  conversations,
  isLoading,
  onClose,
  onLoadMore,
  hasMore,
  onSelect,
  onRename,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');

  const containerClass = useMemo(() => 'history-drawer', []);

  const handleStartEdit = (c: ConversationSummary) => {
    setEditingId(c.id);
    setEditingValue(fallbackTitle(c));
  };

  const handleSubmitEdit = async (id: string) => {
    const value = editingValue.trim();
    setEditingId(null);
    if (!value || !onRename) return;
    try {
      await onRename(id, value);
    } catch {}
  };

  return (
    <SlidePanel isOpen={isOpen} onClose={onClose} title="History" id="history-drawer">
      <div className="history-content" role="list">
        {conversations.map(c => (
          <div key={c.id} role="listitem" className="history-item">
            {editingId === c.id ? (
              <input
                className="rename-input"
                value={editingValue}
                onChange={e => setEditingValue(e.target.value)}
                onBlur={() => handleSubmitEdit(c.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSubmitEdit(c.id);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                autoFocus
              />
            ) : (
              <button className="history-item-btn" title={fallbackTitle(c)} onClick={() => { onSelect(c.id); onClose(); }}>
                <div className="history-item-title">{fallbackTitle(c)}</div>
                <div className="history-item-meta">{c.updated_at ? new Date(c.updated_at).toLocaleString() : ''}</div>
              </button>
            )}
            {onRename && editingId !== c.id && (
              <button className="rename-btn" aria-label="Rename conversation" onClick={() => handleStartEdit(c)}>✎</button>
            )}
          </div>
        ))}

        {isLoading && <div className="history-loading">Loading…</div>}
        {!isLoading && hasMore && (
          <button className="load-more" onClick={onLoadMore}>Load more</button>
        )}
        {!isLoading && conversations.length === 0 && (
          <div className="history-empty">No conversations yet. Start a New Chat to begin!</div>
        )}
      </div>
    </SlidePanel>
  );
};

export default HistoryDrawer;


