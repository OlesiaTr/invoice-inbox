import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DeleteInvoiceDocument,
  GetInvoiceDocument,
  GetInvoicesDocument,
  GetStatusCountsDocument,
  RetryAllFailedInvoicesDocument,
  RetryInvoiceDocument,
  UpdateInvoiceFieldsDocument,
  type InvoicesFilter,
  type UpdateInvoiceFieldsInput,
} from '@/gql/graphql';
import { AccessCodeRequiredError, markAccessCodeRequired } from '@/shared/access-code';
import { API_URL } from '@/shared/config';
import { authHeaders, gql } from '@/shared/graphql';

/** Query keys: lists are keyed by their filter, so one event can patch every cached list. */
export const invoiceKeys = {
  all: ['invoices'] as const,
  lists: () => [...invoiceKeys.all, 'list'] as const,
  list: (filter: InvoicesFilter) => [...invoiceKeys.lists(), filter] as const,
  counts: () => [...invoiceKeys.all, 'counts'] as const,
  detail: (id: string) => [...invoiceKeys.all, 'detail', id] as const,
};

export type InvoicesPage = Awaited<ReturnType<typeof fetchInvoices>>;
export type InvoiceRow = InvoicesPage['items'][number];
export type InvoiceDetail = NonNullable<Awaited<ReturnType<typeof fetchInvoice>>>;

const fetchInvoices = (filter: InvoicesFilter) => gql(GetInvoicesDocument, { filter }).then((d) => d.invoices);
const fetchInvoice = (id: string) => gql(GetInvoiceDocument, { id }).then((d) => d.invoice);

export function useInvoices(filter: InvoicesFilter) {
  return useQuery({
    queryKey: invoiceKeys.list(filter),
    queryFn: () => fetchInvoices(filter),
    placeholderData: keepPreviousData,
  });
}

export function useStatusCounts() {
  return useQuery({
    queryKey: invoiceKeys.counts(),
    queryFn: () => gql(GetStatusCountsDocument).then((d) => d.statusCounts),
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: invoiceKeys.detail(id ?? ''),
    queryFn: () => fetchInvoice(id!),
    enabled: !!id,
  });
}

/**
 * Mutations only invalidate as a fallback: the database trigger → subscription
 * normally delivers the change first (see useInvoiceLiveUpdates).
 */
function useInvalidateInvoices() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: invoiceKeys.all });
}

export function useRetryInvoice() {
  const qc = useQueryClient();
  const invalidate = useInvalidateInvoices();
  return useMutation({
    mutationFn: (id: string) => gql(RetryInvoiceDocument, { id }).then((d) => d.retryInvoice),
    // Optimistic: the row flips to "uploaded" immediately; rolled back if the server refuses.
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: invoiceKeys.lists() });
      const previous = qc.getQueriesData<InvoicesPage>({ queryKey: invoiceKeys.lists() });
      patchInvoiceInLists(qc, id, { status: 'uploaded', errorReason: null });
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      for (const [key, data] of ctx?.previous ?? []) qc.setQueryData(key, data);
    },
    onSettled: invalidate,
  });
}

export function useRetryAllFailed() {
  const invalidate = useInvalidateInvoices();
  return useMutation({
    mutationFn: () => gql(RetryAllFailedInvoicesDocument).then((d) => d.retryAllFailedInvoices.retried),
    onSettled: invalidate,
  });
}

export function useDeleteInvoice() {
  const invalidate = useInvalidateInvoices();
  return useMutation({
    mutationFn: (id: string) => gql(DeleteInvoiceDocument, { id }),
    onSettled: invalidate,
  });
}

export function useUpdateInvoiceFields() {
  const invalidate = useInvalidateInvoices();
  return useMutation({
    mutationFn: (v: { id: string; input: UpdateInvoiceFieldsInput }) => gql(UpdateInvoiceFieldsDocument, v),
    onSettled: invalidate,
  });
}

export interface UploadResult {
  invoice: { id: string; originalName: string };
  duplicateOf: { id: string; originalName: string } | null;
}

/** Network failure or server temporarily down: the request may or may not have been processed. */
class RetryableUploadError extends Error {}

/**
 * File bytes go over REST (see backend InvoicesController for why).
 *
 * The upload is retried automatically after network errors and 5xx responses — safe because
 * every attempt carries the same Idempotency-Key: if an earlier attempt was committed but its
 * response got lost (e.g. the API restarted), the server returns that invoice instead of
 * creating a duplicate.
 */
export async function uploadInvoice(file: File, { retryDelaysMs = [1000, 3000, 6000] } = {}): Promise<UploadResult> {
  const idempotencyKey = crypto.randomUUID();
  for (let attempt = 0; ; attempt++) {
    try {
      return await uploadOnce(file, idempotencyKey);
    } catch (err) {
      if (!(err instanceof RetryableUploadError) || attempt >= retryDelaysMs.length) throw err;
      await new Promise((r) => setTimeout(r, retryDelaysMs[attempt]));
    }
  }
}

async function uploadOnce(file: File, idempotencyKey: string): Promise<UploadResult> {
  const body = new FormData();
  body.append('file', file);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/invoices`, {
      method: 'POST',
      body,
      headers: { ...authHeaders(), 'Idempotency-Key': idempotencyKey },
    });
  } catch {
    throw new RetryableUploadError('Could not reach the server');
  }
  if (res.status === 401) {
    markAccessCodeRequired();
    throw new AccessCodeRequiredError();
  }
  if (res.status >= 500 || !res.headers.get('content-type')?.includes('json')) {
    throw new RetryableUploadError(`The server is unavailable right now (HTTP ${res.status}). Try again in a moment.`);
  }
  // Nest's error body carries `message` as a string, or an array of them from a validation pipe.
  const json = (await res.json()) as UploadResult & { message?: string | string[] };
  if (!res.ok) throw new Error(Array.isArray(json.message) ? json.message.join(', ') : json.message);
  return json;
}

export function useUploadInvoice() {
  const invalidate = useInvalidateInvoices();
  return useMutation({ mutationFn: (file: File) => uploadInvoice(file), onSettled: invalidate });
}

export function invoiceFileUrl(id: string): string {
  const code = authHeaders()['x-access-code'];
  return `${API_URL}/api/invoices/${id}/file${code ? `?access_code=${encodeURIComponent(code)}` : ''}`;
}

export function patchInvoiceInLists(qc: ReturnType<typeof useQueryClient>, id: string, patch: Partial<InvoiceRow>) {
  qc.setQueriesData<InvoicesPage>(
    { queryKey: invoiceKeys.lists() },
    (page) =>
      page && {
        ...page,
        items: page.items.map((row) => (row.id === id ? { ...row, ...patch } : row)),
      },
  );
}
