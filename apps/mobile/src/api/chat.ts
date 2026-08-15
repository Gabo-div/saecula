import { fetch as expoFetch } from 'expo/fetch';

import { useAuthStore } from '@/store/authStore';
import type { ConversationResponse, ConversationsResponse } from '@/types/api';

import { api } from './client';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

// ChatError carries the HTTP status so the UI can tell "chat disabled" (503)
// apart from other failures.
export class ChatError extends Error {
  constructor(public status: number) {
    super(`chat request failed (${status})`);
    this.name = 'ChatError';
  }
}

export interface StreamHandlers {
  onToken: (text: string) => void;
  onTool?: (name: string) => void;
  signal?: AbortSignal;
}

// parseFrame turns one SSE frame ("event: x\ndata: {...}") into its parts.
// Multiple data: lines are joined with newlines, per the SSE spec.
function parseFrame(frame: string): { event: string; data: string } {
  let event = '';
  const data: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
  }
  return { event, data: data.join('\n') };
}

// streamChat posts a message and consumes the Server-Sent Events stream via
// expo/fetch (whose response.body is a real ReadableStream). It forwards answer
// tokens as they arrive and resolves with the persisted ids on completion.
export async function streamChat(
  body: { conversation_id?: string; message: string; lang: string },
  h: StreamHandlers,
): Promise<{ conversation_id: string; message_id: string }> {
  const token = useAuthStore.getState().token;
  const res = await expoFetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal: h.signal,
  });

  if (!res.ok) {
    if (res.status === 401) useAuthStore.getState().logout();
    throw new ChatError(res.status);
  }
  if (!res.body) throw new ChatError(0);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let result: { conversation_id: string; message_id: string } | null = null;
  let errorMessage: string | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buf.indexOf('\n\n')) !== -1) {
      const { event, data } = parseFrame(buf.slice(0, sep));
      buf = buf.slice(sep + 2);
      if (!event || !data) continue;
      const payload = JSON.parse(data);
      if (event === 'token') h.onToken(payload.text ?? '');
      else if (event === 'tool') h.onTool?.(payload.name ?? '');
      else if (event === 'done') result = payload;
      else if (event === 'error') errorMessage = payload.message ?? 'error';
    }
  }

  if (errorMessage) throw new Error(errorMessage);
  if (!result) throw new Error('stream ended without completion');
  return result;
}

export async function listConversations(): Promise<ConversationsResponse> {
  const { data } = await api.get<ConversationsResponse>('/api/chat/conversations');
  return data;
}

export async function getConversation(id: string): Promise<ConversationResponse> {
  const { data } = await api.get<ConversationResponse>(
    `/api/chat/conversations/${encodeURIComponent(id)}`,
  );
  return data;
}

export async function deleteConversation(id: string): Promise<void> {
  await api.delete(`/api/chat/conversations/${encodeURIComponent(id)}`);
}
