import { useCallback, useState } from 'react';
import type { UpdateInvoiceFieldsInput } from '@/gql/graphql';
import { useUpdateInvoiceFields, type InvoiceDetail } from './api';
import { coerceFieldValue, INVOICE_FIELDS, type FieldKey } from './fields';

type Draft = Record<string, string>;

function draftFrom(data: NonNullable<InvoiceDetail['extractedData']>): Draft {
  return Object.fromEntries(INVOICE_FIELDS.map((f) => [f.key, data[f.key]?.toString() ?? '']));
}

/**
 * Edit state for an invoice's extracted header fields: which fields changed, how their
 * values are coerced, and the save call. The component using it only renders.
 */
export function useInvoiceFieldsForm(invoice: InvoiceDetail) {
  const data = invoice.extractedData;
  const update = useUpdateInvoiceFields();

  // `editing` is keyed by invoice id so opening a different invoice closes the form
  // without an effect — the detail sheet reuses this component across invoices.
  const [state, setState] = useState<{ editing: boolean; draft: Draft; invoiceId: string }>({
    editing: false,
    draft: {},
    invoiceId: invoice.id,
  });
  const editing = state.invoiceId === invoice.id && state.editing;
  const draft = state.invoiceId === invoice.id ? state.draft : {};

  const start = useCallback(() => {
    setState({ editing: true, draft: data ? draftFrom(data) : {}, invoiceId: invoice.id });
  }, [data, invoice.id]);

  const cancel = useCallback(() => {
    setState((s) => ({ ...s, editing: false }));
  }, []);

  const setField = useCallback((key: FieldKey, value: string) => {
    setState((s) => ({ ...s, draft: { ...s.draft, [key]: value } }));
  }, []);

  /** Only what actually changed is sent; an emptied field means "clear it". */
  const changedFields = (): UpdateInvoiceFieldsInput => {
    if (!data) return {};
    const input: Record<string, string | number | null> = {};
    for (const f of INVOICE_FIELDS) {
      const before = data[f.key]?.toString() ?? '';
      const after = draft[f.key]?.trim() ?? '';
      if (before === after) continue;
      input[f.key] = after === '' ? null : coerceFieldValue(f.key, after);
    }
    return input;
  };

  const save = (handlers: { onSuccess?: () => void; onError?: (message: string) => void } = {}) => {
    const input = changedFields();
    // Nothing to send: treat Save as a plain close rather than a no-op request.
    if (Object.keys(input).length === 0) {
      cancel();
      return;
    }
    update.mutate(
      { id: invoice.id, input },
      {
        onSuccess: () => {
          cancel();
          handlers.onSuccess?.();
        },
        onError: (err) => handlers.onError?.(err.message),
      },
    );
  };

  return { editing, draft, start, cancel, setField, save, isSaving: update.isPending };
}
