import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphql } from '@/gql';
import type { InvoicesFilter, UpdateInvoiceFieldsInput } from '@/gql/graphql';
import { AccessCodeRequiredError, markAccessCodeRequired } from '@/shared/access-code';
import { API_URL } from '@/shared/config';
import { authHeaders, gql } from '@/shared/graphql';

export const InvoiceRowFields = graphql(`
  fragment InvoiceRow on Invoice {
    id
    originalName
    mimeType
    status
    attempts
    errorReason
    warnings
    vendorName
    invoiceNumber
    issueDate
    total
    currency
    createdAt
    updatedAt
  }
`);

const InvoicesQuery = graphql(`
  query Invoices($filter: InvoicesFilter) {
    invoices(filter: $filter) {
      total
      items {
        ...InvoiceRow
      }
    }
  }
`);

const StatusCountsQuery = graphql(`
  query StatusCounts {
    statusCounts {
      all
      uploaded
      processing
      completed
      failed
    }
  }
`);

const InvoiceQuery = graphql(`
  query Invoice($id: ID!) {
    invoice(id: $id) {
      ...InvoiceRow
      sizeBytes
      completedAt
      rawText
      extractedData {
        invoiceNumber
        vendorName
        vendorAddress
        customerName
        issueDate
        dueDate
        currency
        subtotal
        tax
        total
        lineItems {
          description
          quantity
          unitPrice
          amount
        }
      }
    }
  }
`);

const RetryInvoiceMutation = graphql(`
  mutation RetryInvoice($id: ID!) {
    retryInvoice(id: $id) {
      ...InvoiceRow
    }
  }
`);

const RetryAllFailedMutation = graphql(`
  mutation RetryAllFailed {
    retryAllFailedInvoices {
      retried
    }
  }
`);

const DeleteInvoiceMutation = graphql(`
  mutation DeleteInvoice($id: ID!) {
    deleteInvoice(id: $id) {
      id
    }
  }
`);

const UpdateInvoiceFieldsMutation = graphql(`
  mutation UpdateInvoiceFields($id: ID!, $input: UpdateInvoiceFieldsInput!) {
    updateInvoiceFields(id: $id, input: $input) {
      id
    }
  }
`);

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

const fetchInvoices = (filter: InvoicesFilter) => gql(InvoicesQuery, { filter }).then((d) => d.invoices);
const fetchInvoice = (id: string) => gql(InvoiceQuery, { id }).then((d) => d.invoice);

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
    queryFn: () => gql(StatusCountsQuery).then((d) => d.statusCounts),
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
    mutationFn: (id: string) => gql(RetryInvoiceMutation, { id }).then((d) => d.retryInvoice),
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
    mutationFn: () => gql(RetryAllFailedMutation).then((d) => d.retryAllFailedInvoices.retried),
    onSettled: invalidate,
  });
}

export function useDeleteInvoice() {
  const invalidate = useInvalidateInvoices();
  return useMutation({
    mutationFn: (id: string) => gql(DeleteInvoiceMutation, { id }),
    onSettled: invalidate,
  });
}

export function useUpdateInvoiceFields() {
  const invalidate = useInvalidateInvoices();
  return useMutation({
    mutationFn: (v: { id: string; input: UpdateInvoiceFieldsInput }) => gql(UpdateInvoiceFieldsMutation, v),
    onSettled: invalidate,
  });
}

export interface UploadResult {
  invoice: { id: string; originalName: string };
  duplicateOf: { id: string; originalName: string } | null;
}

/** File bytes go over REST (see backend InvoicesController for why). */
export async function uploadInvoice(file: File): Promise<UploadResult> {
  const body = new FormData();
  body.append('file', file);
  const res = await fetch(`${API_URL}/api/invoices`, { method: 'POST', body, headers: authHeaders() });
  if (res.status === 401) {
    markAccessCodeRequired();
    throw new AccessCodeRequiredError();
  }
  const json = await res.json();
  if (!res.ok) throw new Error(Array.isArray(json.message) ? json.message.join(', ') : json.message);
  return json as UploadResult;
}

export function useUploadInvoice() {
  const invalidate = useInvalidateInvoices();
  return useMutation({ mutationFn: uploadInvoice, onSettled: invalidate });
}

export function invoiceFileUrl(id: string): string {
  const code = authHeaders()['x-access-code'];
  return `${API_URL}/api/invoices/${id}/file${code ? `?access_code=${encodeURIComponent(code)}` : ''}`;
}

export function patchInvoiceInLists(
  qc: ReturnType<typeof useQueryClient>,
  id: string,
  patch: Partial<InvoiceRow>,
) {
  qc.setQueriesData<InvoicesPage>({ queryKey: invoiceKeys.lists() }, (page) =>
    page && {
      ...page,
      items: page.items.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    },
  );
}
