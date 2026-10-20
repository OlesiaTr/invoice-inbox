import { Bot, Check, Loader2, Send, ShieldAlert, Sparkles, Trash2, Wrench, X } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useDeleteInvoice, useUpdateInvoiceFields } from '@/features/invoices/api';
import type { UpdateInvoiceFieldsInput } from '@/gql/graphql';
import { cn } from '@/lib/utils';
import { useAssistantChat, type AssistantReply, type PendingAction } from './api';
import { Markdown } from './Markdown';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: AssistantReply['actions'];
  pending?: (PendingAction & { state: 'open' | 'confirmed' | 'cancelled' })[];
}

const STORAGE_KEY = 'invoice-inbox.chat';
const SUGGESTIONS = [
  'Which invoices failed and why?',
  'Retry all failed invoices',
  'How much did we spend per vendor?',
  'Show invoices with warnings',
];

function loadHistory(): Message[] {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]') as Message[];
  } catch {
    return [];
  }
}

const wide = window.matchMedia('(min-width: 1280px)');
const useWideScreen = () =>
  useSyncExternalStore(
    (cb) => {
      wide.addEventListener('change', cb);
      return () => wide.removeEventListener('change', cb);
    },
    () => wide.matches,
  );

/** Docked column on wide screens, slide-over sheet on smaller ones. */
export function AssistantPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const isWide = useWideScreen();
  if (isWide) {
    if (!open) return null;
    return (
      <aside className="sticky top-22 h-[calc(100vh-7rem)] w-[400px] shrink-0 overflow-hidden rounded-xl bg-card shadow-md dark:shadow-dark-md">
        <Chat onClose={() => onOpenChange(false)} />
      </aside>
    );
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full p-0 sm:max-w-md [&>button:last-child]:hidden">
        <SheetTitle className="sr-only">Assistant</SheetTitle>
        <Chat onClose={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

function Chat({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>(loadHistory);
  const [input, setInput] = useState('');
  const chat = useAssistantChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
    } catch {
      // storage unavailable: history lives in memory only
    }
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, chat.isPending]);

  const send = (text: string) => {
    const content = text.trim();
    if (!content || chat.isPending) return;
    const next = [...messages, { id: crypto.randomUUID(), role: 'user' as const, content }];
    setMessages(next);
    setInput('');
    // The server is stateless: send the visible conversation (text turns only).
    chat.mutate(
      next.map(({ role, content }) => ({ role, content })),
      {
        onSuccess: (r) =>
          setMessages((m) => [
            ...m,
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: r.reply,
              actions: r.actions,
              pending: r.pendingActions.map((p) => ({ ...p, state: 'open' as const })),
            },
          ]),
        onError: (e) =>
          setMessages((m) => [
            ...m,
            { id: crypto.randomUUID(), role: 'assistant', content: `⚠️ ${e.message}` },
          ]),
      },
    );
  };

  const setPendingState = (actionId: string, state: 'confirmed' | 'cancelled') =>
    setMessages((m) =>
      m.map((msg) => ({
        ...msg,
        pending: msg.pending?.map((p) => (p.id === actionId ? { ...p, state } : p)),
      })),
    );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className="flex size-9 items-center justify-center rounded-full bg-lightprimary text-primary">
          <Sparkles className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-dark dark:text-white">Assistant</p>
          <p className="text-xs text-muted-foreground">Asks the system, takes actions</p>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="icon" className="size-8" aria-label="Clear chat" onClick={() => setMessages([])}>
            <Trash2 />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="size-8" aria-label="Close assistant" onClick={onClose}>
          <X />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-3 pt-6 text-center">
            <Bot className="mx-auto size-10 text-primary" />
            <p className="text-sm text-muted-foreground">
              Ask about invoice statuses or results, or tell me what to do.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs hover:border-primary hover:text-primary"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={cn('flex flex-col gap-2', m.role === 'user' ? 'items-end' : 'items-start')}>
            {m.actions && m.actions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {m.actions.map((a, i) => (
                  <span
                    key={i}
                    title={a.summary}
                    className={cn(
                      'inline-flex max-w-full items-start gap-1 break-words rounded-md px-2 py-0.5 text-xs',
                      a.ok ? 'bg-lightsuccess text-success' : 'bg-lighterror text-error',
                    )}
                  >
                    <Wrench className="mt-0.5 size-3 shrink-0" /> <span>{a.summary}</span>
                  </span>
                ))}
              </div>
            )}
            <div
              className={cn(
                'max-w-[90%] rounded-xl px-3.5 py-2.5 text-sm',
                m.role === 'user' ? 'bg-primary text-white' : 'bg-muted text-foreground',
              )}
            >
              {m.role === 'assistant' ? <Markdown text={m.content} /> : m.content}
            </div>
            {m.role === 'assistant' && m.actions?.length === 0 && !m.pending?.length && (
              // Small models sometimes answer from memory; make unsourced answers visible.
              <p className="text-xs text-muted-foreground">No data was looked up and no action was taken.</p>
            )}
            {m.pending?.map((p) => (
              <PendingActionCard key={p.id} action={p} onStateChange={(s) => setPendingState(p.id, s)} />
            ))}
          </div>
        ))}

        {chat.isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Thinking…
          </div>
        )}
      </div>

      <form onSubmit={submit} className="flex items-end gap-2 border-t border-border p-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask or instruct… (Enter to send)"
          className="max-h-32 min-h-10 resize-none"
          rows={1}
          aria-label="Message the assistant"
        />
        <Button type="submit" size="icon" disabled={!input.trim() || chat.isPending} aria-label="Send">
          <Send />
        </Button>
      </form>
    </div>
  );
}

const NUMERIC_FIELDS = new Set(['subtotal', 'tax', 'total']);

/**
 * Destructive actions proposed by the assistant run only from here, through the same
 * mutations the regular UI uses — the human click is the safety gate.
 */
function PendingActionCard({
  action,
  onStateChange,
}: {
  action: PendingAction & { state: 'open' | 'confirmed' | 'cancelled' };
  onStateChange: (s: 'confirmed' | 'cancelled') => void;
}) {
  const remove = useDeleteInvoice();
  const update = useUpdateInvoiceFields();
  const busy = remove.isPending || update.isPending;

  const confirm = () => {
    const done = {
      onSuccess: () => {
        onStateChange('confirmed');
        toast.success(action.summary);
      },
      onError: (e: Error) => toast.error(e.message),
    };
    if (action.kind === 'delete_invoice') {
      remove.mutate(action.invoiceId, done);
    } else if (action.field) {
      const value = JSON.parse(action.valueJson ?? 'null') as string | number | null;
      const input = {
        [action.field]: NUMERIC_FIELDS.has(action.field) && value !== null ? Number(value) : value,
      } as UpdateInvoiceFieldsInput;
      update.mutate({ id: action.invoiceId, input }, done);
    }
  };

  return (
    <div className="w-[90%] rounded-xl border border-warning/40 bg-lightwarning p-3 text-sm">
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-dark dark:text-white">{action.summary}</p>
          {action.state === 'open' ? (
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant={action.kind === 'delete_invoice' ? 'error' : 'default'} disabled={busy} onClick={confirm}>
                {busy ? <Loader2 className="animate-spin" /> : <Check />} Confirm
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => onStateChange('cancelled')}>
                Cancel
              </Button>
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              {action.state === 'confirmed' ? 'Done.' : 'Cancelled — nothing changed.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
