import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { InvoiceEventsDocument, type InvoiceEventsSubscription } from '@/gql/graphql';
import { onWsConnected, wsClient } from '@/shared/ws';
import { invoiceKeys, patchInvoiceInLists, type InvoicesPage } from './api';

type InvoiceEvent = InvoiceEventsSubscription['invoiceEvents'];

/**
 * Keeps every cached invoice query in sync with the server, without polling.
 *
 * - Status changes are patched into cached lists instantly (setQueryData).
 * - Events that change list membership or extracted data (insert, delete, completed,
 *   failed) also trigger a debounced refetch — the event only carries id + status.
 * - After a WebSocket reconnect (or a server-side RESYNC) everything is refetched,
 *   because events sent while we were offline are lost: the DB is the source of truth.
 */
export function useInvoiceLiveUpdates() {
  const qc = useQueryClient();
  const refetchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const refetchSoon = () => {
      clearTimeout(refetchTimer.current);
      // Debounced: a batch upload produces bursts of events; one refetch covers them all.
      refetchTimer.current = setTimeout(() => void qc.invalidateQueries({ queryKey: invoiceKeys.all }), 300);
    };

    const handle = (e: InvoiceEvent) => {
      if (e.type === 'RESYNC' || !e.id) return refetchSoon();
      if (e.type === 'DELETE') {
        qc.removeQueries({ queryKey: invoiceKeys.detail(e.id) });
        return refetchSoon();
      }
      if (e.status) {
        const before = findCachedStatus(qc, e.id);
        patchInvoiceInLists(qc, e.id, { status: e.status, ...(e.updatedAt ? { updatedAt: e.updatedAt } : {}) });
        if (before && before !== e.status) notify(e, qc);
      }
      void qc.invalidateQueries({ queryKey: invoiceKeys.detail(e.id) });
      void qc.invalidateQueries({ queryKey: invoiceKeys.counts() });
      if (e.type === 'INSERT' || e.status === 'completed' || e.status === 'failed') refetchSoon();
    };

    const unsubscribe = wsClient().subscribe<{ invoiceEvents: InvoiceEvent }>(
      { query: InvoiceEventsDocument.toString() },
      {
        next: ({ data }) => data && handle(data.invoiceEvents),
        error: () => undefined, // graphql-ws retries; the reconnect handler resyncs
        complete: () => undefined,
      },
    );
    const offConnected = onWsConnected((isReconnect) => isReconnect && refetchSoon());

    return () => {
      unsubscribe();
      offConnected();
      clearTimeout(refetchTimer.current);
    };
  }, [qc]);
}

function findCachedStatus(qc: ReturnType<typeof useQueryClient>, id: string) {
  for (const [, page] of qc.getQueriesData<InvoicesPage>({ queryKey: invoiceKeys.lists() })) {
    const row = page?.items.find((r) => r.id === id);
    if (row) return row.status;
  }
  return undefined;
}

function notify(e: InvoiceEvent, qc: ReturnType<typeof useQueryClient>) {
  let name = 'Invoice';
  for (const [, page] of qc.getQueriesData<InvoicesPage>({ queryKey: invoiceKeys.lists() })) {
    const row = page?.items.find((r) => r.id === e.id);
    if (row) name = row.invoiceNumber ?? row.originalName;
  }
  if (e.status === 'completed') toast.success(`${name} processed`);
  if (e.status === 'failed') toast.error(`${name} failed`, { description: 'Open it to see why, or retry.' });
}
