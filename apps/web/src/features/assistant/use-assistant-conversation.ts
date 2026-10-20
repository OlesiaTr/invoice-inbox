import { useCallback, useEffect, useState } from 'react';
import { useAssistantChat, type AssistantReply, type PendingAction } from './api';

export type PendingActionState = 'open' | 'confirmed' | 'cancelled';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: AssistantReply['actions'];
  pending?: (PendingAction & { state: PendingActionState })[];
}

const STORAGE_KEY = 'invoice-inbox.chat';
/** Keep the stored transcript bounded; the server only ever sees the recent turns anyway. */
const MAX_PERSISTED = 40;

function loadHistory(): Message[] {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]') as Message[];
  } catch {
    return [];
  }
}

/**
 * The conversation itself: transcript, persistence, sending a turn, and the state of any
 * destructive action the assistant has proposed. Rendering lives in AssistantPanel.
 */
export function useAssistantConversation() {
  const [messages, setMessages] = useState<Message[]>(loadHistory);
  const chat = useAssistantChat();

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_PERSISTED)));
    } catch {
      // storage unavailable (private mode): history lives in memory only
    }
  }, [messages]);

  const append = useCallback((message: Message) => {
    setMessages((m) => [...m, message]);
  }, []);

  const send = useCallback(
    (text: string) => {
      const content = text.trim();
      if (!content || chat.isPending) return;
      const next: Message[] = [...messages, { id: crypto.randomUUID(), role: 'user', content }];
      setMessages(next);
      // The server is stateless: send the visible conversation (text turns only).
      chat.mutate(
        next.map(({ role, content }) => ({ role, content })),
        {
          onSuccess: (r) =>
            append({
              id: crypto.randomUUID(),
              role: 'assistant',
              content: r.reply,
              actions: r.actions,
              pending: r.pendingActions.map((p) => ({ ...p, state: 'open' as const })),
            }),
          onError: (e) => append({ id: crypto.randomUUID(), role: 'assistant', content: `⚠️ ${e.message}` }),
        },
      );
    },
    [append, chat, messages],
  );

  const setPendingState = useCallback((actionId: string, state: Exclude<PendingActionState, 'open'>) => {
    setMessages((m) =>
      m.map((msg) => ({
        ...msg,
        pending: msg.pending?.map((p) => (p.id === actionId ? { ...p, state } : p)),
      })),
    );
  }, []);

  const clear = useCallback(() => setMessages([]), []);

  return { messages, send, setPendingState, clear, isPending: chat.isPending };
}
