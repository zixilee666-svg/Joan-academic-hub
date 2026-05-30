import { apiClient } from './api';
import type { AIConversation } from '@/types';

export const chatService = {
  list: () => apiClient.get<AIConversation[]>('/chats'),

  get: (id: string) => apiClient.get<AIConversation>(`/chats/${id}`),

  create: (title?: string) => apiClient.post<AIConversation>('/chats', { title }),

  update: (id: string, data: Partial<AIConversation>) =>
    apiClient.put<AIConversation>(`/chats/${id}`, data),

  delete: (id: string) => apiClient.delete<null>(`/chats/${id}`),

  // SSE streaming for AI chat
  chatStream: async (conversationId: string, message: string, mode?: string): Promise<ReadableStream> => {
    const token = (() => {
      try {
        return JSON.parse(localStorage.getItem('joan_auth_token') || 'null');
      } catch {
        return null;
      }
    })();

    const res = await fetch('/api-ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ conversationId, message, mode }),
    });

    if (!res.ok) throw new Error('Chat request failed');
    return res.body!;
  },
};
