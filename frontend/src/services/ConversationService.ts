import { ConversationSummary, ConversationTurn } from '../types/conversation.types';

export class ConversationService {
  private backendUrl: string;

  constructor(backendUrl?: string) {
    this.backendUrl = backendUrl || process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
  }

  private authHeaders() {
    const accessToken = localStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    } as HeadersInit;
  }

  async listConversations(limit = 20, offset = 0): Promise<ConversationSummary[]> {
    const res = await fetch(`${this.backendUrl}/api/conversations?limit=${limit}&offset=${offset}`, {
      method: 'GET',
      headers: this.authHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Failed to list conversations (${res.status})`);
    return res.json();
  }

  async listTurns(conversationId: string, limit = 50, offset = 0): Promise<ConversationTurn[]> {
    const res = await fetch(`${this.backendUrl}/api/conversations/${conversationId}/turns?limit=${limit}&offset=${offset}`, {
      method: 'GET',
      headers: this.authHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Failed to list turns (${res.status})`);
    return res.json();
  }

  async updateConversation(
    conversationId: string,
    payload: Partial<Pick<ConversationSummary, 'title' | 'topic' | 'is_active'>>
  ): Promise<ConversationSummary> {
    const res = await fetch(`${this.backendUrl}/api/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: this.authHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to update conversation (${res.status})`);
    return res.json();
  }

  async deleteConversation(conversationId: string): Promise<void> {
    const res = await fetch(`${this.backendUrl}/api/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: this.authHeaders(),
      credentials: 'include',
    });
    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unknown error');
      throw new Error(`Failed to delete conversation (${res.status}): ${errorText}`);
    }
  }

  async deleteTurn(conversationId: string, turnId: string): Promise<void> {
    const res = await fetch(`${this.backendUrl}/api/conversations/${conversationId}/turns/${turnId}`, {
      method: 'DELETE',
      headers: this.authHeaders(),
      credentials: 'include',
    });
    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unknown error');
      throw new Error(`Failed to delete turn (${res.status}): ${errorText}`);
    }
  }
}


