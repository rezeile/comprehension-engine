import React, { useMemo, useState, useEffect, useCallback } from 'react';
import './HistoryDrawer.css';
import SlidePanel from '../SlidePanel/SlidePanel';
import { ConversationSummary } from '../../types/conversation.types';
import { TrashIcon } from '../Icons';

interface HistoryDrawerProps {
  isOpen: boolean;
  conversations: ConversationSummary[];
  isLoading: boolean;
  error?: string | null;
  onClose: () => void;
  onLoadMore: () => void;
  hasMore: boolean;
  onSelect: (id: string) => void;
  onRename?: (id: string, newTitle: string) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
}

const fallbackTitle = (c: ConversationSummary) => c.title?.trim() || 'New Chat';

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  conversations,
  isLoading,
  error,
  onClose,
  onLoadMore,
  hasMore,
  onSelect,
  onRename,
  onDelete,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

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

  const handleDeleteClick = (id: string) => {
    setShowDeleteConfirm(id);
  };

  const handleDeleteConfirm = useCallback(async (id: string) => {
    if (!onDelete || deletingId) return; // Prevent multiple calls
    
    setShowDeleteConfirm(null);
    setDeletingId(id);
    
    try {
      await onDelete(id);
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      // Error will be handled by parent component via optimistic UI rollback
    } finally {
      setDeletingId(null);
    }
  }, [onDelete, deletingId]);

  const handleDeleteCancel = useCallback(() => {
    setShowDeleteConfirm(null);
  }, []);

  // Handle keyboard events for delete confirmation modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showDeleteConfirm) return;
      
      if (e.key === 'Escape') {
        handleDeleteCancel();
      } else if (e.key === 'Enter') {
        handleDeleteConfirm(showDeleteConfirm);
      }
    };

    if (showDeleteConfirm) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [showDeleteConfirm, handleDeleteCancel, handleDeleteConfirm]);

  return (
    <SlidePanel isOpen={isOpen} onClose={onClose} title="History" id="history-drawer">
      <div className="history-content" role="list">
        {error && (
          <div className="history-loading" role="alert">{error}</div>
        )}
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
            {editingId !== c.id && (
              <div className="history-item-actions">
                {onRename && (
                  <button 
                    className="rename-btn" 
                    aria-label="Rename conversation" 
                    title="Rename conversation"
                    onClick={() => handleStartEdit(c)}
                  >
                    ✎
                  </button>
                )}
                {onDelete && (
                  <button 
                    className="delete-btn"
                    aria-label="Delete conversation"
                    title="Delete conversation"
                    onClick={() => handleDeleteClick(c.id)}
                    disabled={deletingId === c.id}
                  >
                    <TrashIcon width={16} height={16} />
                  </button>
                )}
              </div>
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

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div 
          className="delete-confirmation-backdrop" 
          onClick={handleDeleteCancel}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          aria-describedby="delete-modal-description"
        >
          <div className="delete-confirmation-modal" onClick={(e) => e.stopPropagation()}>
            <h3 id="delete-modal-title">Delete Conversation</h3>
            <p id="delete-modal-description">
              Are you sure you want to delete this conversation? This action cannot be undone.
            </p>
            <div className="delete-confirmation-actions">
              <button 
                className="cancel-btn" 
                onClick={handleDeleteCancel}
                autoFocus
                aria-label="Cancel deletion"
              >
                Cancel
              </button>
              <button 
                className="confirm-delete-btn" 
                onClick={() => handleDeleteConfirm(showDeleteConfirm)}
                disabled={!!deletingId}
                aria-label="Confirm deletion"
              >
                {deletingId ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </SlidePanel>
  );
};

export default HistoryDrawer;


