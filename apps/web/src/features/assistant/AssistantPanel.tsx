import { Bot, Check, Loader2, Send, ShieldAlert, Sparkles, Trash2, Wrench, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useDeleteInvoice, useUpdateInvoiceFields } from '@/features/invoices/api';
import { coerceFieldValue } from '@/features/invoices/fields';
import type { UpdateInvoiceFieldsInput } from '@/gql/graphql';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/shared/use-media-query';
import { useAssistantConversation, type Message, type PendingActionState } from './use-assistant-conversation';
import type { PendingAction } from './api';
import { Markdown } from './Markdown';

const SUGGESTIONS = [
  'Which invoices failed and why?',
  'Retry all failed invoices',
  'How much did we spend per vendor?',
  'Show invoices with warnings',
];

/** Docked column on wide screens, slide-over sheet on smaller ones. */
export function AssistantPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const isWide = useMediaQuery('(min-width: 1280px)');

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
  const { messages, send, setPendingState, clear, isPending } = useAssistantConversation();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isPending]);

  const submitInput = () => {
    send(input);
    setInput('');
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    submitInput();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitInput();
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
          <Button variant="ghost" size="icon" className="size-8" aria-label="Clear chat" onClick={clear}>
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
          <MessageBubble key={m.id} message={m} onPendingStateChange={setPendingState} />
        ))}

        {isPending && (
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
        <Button type="submit" size="icon" disabled={!input.trim() || isPending} aria-label="Send">
          <Send />
        </Button>
      </form>
    </div>
  );
}

function MessageBubble({
  message,
  onPendingStateChange,
}: {
  message: Message;
  onPendingStateChange: (actionId: string, state: Exclude<PendingActionState, 'open'>) => void;
}) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex flex-col gap-2', isUser ? 'items-end' : 'items-start')}>
      {message.actions && message.actions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {message.actions.map((a, i) => (
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
          isUser ? 'bg-primary text-white' : 'bg-muted text-foreground',
        )}
      >
        {isUser ? message.content : <Markdown text={message.content} />}
      </div>
      {!isUser && message.actions?.length === 0 && !message.pending?.length && (
        // Small models sometimes answer from memory; make unsourced answers visible.
        <p className="text-xs text-muted-foreground">No data was looked up and no action was taken.</p>
      )}
      {message.pending?.map((p) => (
        <PendingActionCard key={p.id} action={p} onStateChange={(s) => onPendingStateChange(p.id, s)} />
      ))}
    </div>
  );
}

/**
 * Destructive actions proposed by the assistant run only from here, through the same
 * mutations the regular UI uses — the human click is the safety gate.
 */
function PendingActionCard({
  action,
  onStateChange,
}: {
  action: PendingAction & { state: PendingActionState };
  onStateChange: (s: Exclude<PendingActionState, 'open'>) => void;
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
      return;
    }
    if (!action.field) return;
    const raw = JSON.parse(action.valueJson ?? 'null') as string | number | null;
    // Coerced through the shared field descriptor, so this agrees with the detail form.
    const input = { [action.field]: coerceFieldValue(action.field, raw) } as UpdateInvoiceFieldsInput;
    update.mutate({ id: action.invoiceId, input }, done);
  };

  return (
    <div className="w-[90%] rounded-xl border border-warning/40 bg-lightwarning p-3 text-sm">
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-dark dark:text-white">{action.summary}</p>
          {action.state === 'open' ? (
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                variant={action.kind === 'delete_invoice' ? 'error' : 'default'}
                disabled={busy}
                onClick={confirm}
              >
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
