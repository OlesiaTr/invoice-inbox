import type { UpdateInvoiceFieldsInput } from '@/gql/graphql';

export type FieldKey = keyof UpdateInvoiceFieldsInput;
export type FieldType = 'text' | 'date' | 'number';

export interface FieldDescriptor {
  key: FieldKey;
  label: string;
  type: FieldType;
}

/**
 * The editable header fields, in the order they are shown. Single source of truth: the
 * detail form renders from it and the assistant's confirmation card coerces values with
 * it, so "which fields are numeric" can't drift between the two.
 *
 * Mirrors EDITABLE_FIELDS in the backend's invoices/domain/invoice-data.ts.
 */
export const INVOICE_FIELDS: readonly FieldDescriptor[] = [
  { key: 'vendorName', label: 'Vendor', type: 'text' },
  { key: 'invoiceNumber', label: 'Invoice number', type: 'text' },
  { key: 'customerName', label: 'Customer', type: 'text' },
  { key: 'vendorAddress', label: 'Vendor address', type: 'text' },
  { key: 'issueDate', label: 'Issue date', type: 'date' },
  { key: 'dueDate', label: 'Due date', type: 'date' },
  { key: 'currency', label: 'Currency', type: 'text' },
  { key: 'subtotal', label: 'Subtotal', type: 'number' },
  { key: 'tax', label: 'Tax', type: 'number' },
  { key: 'total', label: 'Total', type: 'number' },
];

const BY_KEY = new Map(INVOICE_FIELDS.map((f) => [f.key, f]));

export function fieldType(key: string): FieldType | undefined {
  return BY_KEY.get(key as FieldKey)?.type;
}

/**
 * Coerces a form string or an assistant-proposed value into what the API expects for that
 * field. Empty means "clear it"; a numeric field that won't parse stays null rather than
 * being sent as NaN.
 */
export function coerceFieldValue(key: string, value: string | number | null): string | number | null {
  if (value === null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const text = value.trim();
  // Blank means "clear the field" for every type. Checked before Number(), which would
  // otherwise turn '' into 0 and silently save a zero amount.
  if (text === '') return null;
  if (fieldType(key) !== 'number') return text;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}
