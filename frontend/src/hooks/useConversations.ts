import { useCallback, useEffect, useMemo, useState } from 'react';
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
    loadPage(0);
  }, [loadPage]);

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

  return {
    ...state,
    refreshList,
    loadMore,
    renameConversation,
  };
};


