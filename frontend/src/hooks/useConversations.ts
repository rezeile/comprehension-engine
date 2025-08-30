import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ConversationSummary } from '../types/conversation.types';
import { ConversationService } from '../services/ConversationService';

interface UseConversationsState {
  conversations: ConversationSummary[];
  isLoading: boolean;
  error: string | null;
  page: number;
  hasMore: boolean;
}

export const useConversations = () => {
  const conversationService = useMemo(() => new ConversationService(), []);
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [state, setState] = useState<UseConversationsState>({
    conversations: [],
    isLoading: false,
    error: null,
    page: 0,
    hasMore: true,
  });

  const loadPage = useCallback(async (page: number) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const limit = 20;
      const offset = page * limit;
      const list = await conversationService.listConversations(limit, offset);
      setState(prev => ({
        ...prev,
        isLoading: false,
        conversations: page === 0 ? list : [...prev.conversations, ...list],
        page,
        hasMore: list.length === limit,
      }));
    } catch (e) {
      setState(prev => ({ ...prev, isLoading: false, error: e instanceof Error ? e.message : 'Failed to load conversations' }));
    }
  }, [conversationService]);

  useEffect(() => {
    // Only attempt to load when auth is ready and user is authenticated
    if (!isAuthLoading && isAuthenticated) {
      loadPage(0);
    }
  }, [isAuthLoading, isAuthenticated, loadPage]);

  const refreshList = useCallback(async () => {
    await loadPage(0);
  }, [loadPage]);

  const loadMore = useCallback(async () => {
    if (!state.hasMore || state.isLoading) return;
    await loadPage(state.page + 1);
  }, [state.hasMore, state.isLoading, state.page, loadPage]);

  const renameConversation = useCallback(async (id: string, title: string) => {
    try {
      const updated = await conversationService.updateConversation(id, { title });
      setState(prev => ({
        ...prev,
        conversations: prev.conversations.map(c => c.id === id ? { ...c, title: updated.title, updated_at: updated.updated_at } : c)
      }));
    } catch (e) {
      setState(prev => ({ ...prev, error: e instanceof Error ? e.message : 'Failed to rename conversation' }));
      throw e;
    }
  }, [conversationService]);

  const deleteConversation = useCallback(async (id: string) => {
    // Optimistic update: immediately remove from UI
    const originalConversations = state.conversations;
    setState(prev => ({
      ...prev,
      conversations: prev.conversations.filter(c => c.id !== id),
      error: null
    }));

    try {
      await conversationService.deleteConversation(id);
      // Success! The optimistic update is kept
    } catch (e) {
      // Error: rollback the optimistic update
      setState(prev => ({
        ...prev,
        conversations: originalConversations,
        error: e instanceof Error ? e.message : 'Failed to delete conversation'
      }));
      throw e;
    }
  }, [conversationService, state.conversations]);

  const deleteTurn = useCallback(async (conversationId: string, turnId: string) => {
    try {
      await conversationService.deleteTurn(conversationId, turnId);
      // For now, just refresh the conversation list since we don't track individual turns here
      // In the future, this could be optimized to update only the affected conversation
      await refreshList();
    } catch (e) {
      setState(prev => ({ ...prev, error: e instanceof Error ? e.message : 'Failed to delete turn' }));
      throw e;
    }
  }, [conversationService, refreshList]);

  return {
    ...state,
    refreshList,
    loadMore,
    renameConversation,
    deleteConversation,
    deleteTurn,
  };
};


