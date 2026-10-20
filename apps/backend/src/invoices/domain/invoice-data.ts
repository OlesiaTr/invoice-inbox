import { z } from 'zod';

/**
 * Lenient number: models sometimes answer "1,234.50" or "€99" instead of a number.
 * Anything unparseable becomes null rather than failing the whole extraction.
 */
const amount = z.preprocess((v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const digits = v.replace(/[^\d.-]/g, '');
    // "n/a" must become null, not Number('') === 0.
    if (!/\d/.test(digits)) return null;
    const n = Number(digits);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}, z.number().nullable());

/** Lenient date: normalised to YYYY-MM-DD, unparseable → null. */
const isoDate = z.preprocess((v) => {
  if (typeof v !== 'string' || !v.trim()) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}, z.string().nullable());

const text = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() ? v.trim() : null),
  z.string().nullable(),
);

export const lineItemSchema = z.object({
  description: z.string(),
  quantity: amount,
  unitPrice: amount,
  amount,
});

export const extractedInvoiceSchema = z.object({
  invoiceNumber: text,
  vendorName: text,
  vendorAddress: text,
  customerName: text,
  issueDate: isoDate,
  dueDate: isoDate,
  currency: z.preprocess(
    (v) => (typeof v === 'string' && /^[a-z]{3}$/i.test(v.trim()) ? v.trim().toUpperCase() : null),
    z.string().nullable(),
  ),
  subtotal: amount,
  tax: amount,
  total: amount,
  lineItems: z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(lineItemSchema)),
});

export type ExtractedInvoice = z.infer<typeof extractedInvoiceSchema>;
export type LineItem = z.infer<typeof lineItemSchema>;

/**
 * Strict JSON schema handed to the model as "structured output" — what we ask for.
 * The lenient zod schema above is what we accept back.
 */
const nullableString = { type: ['string', 'null'] };
const nullableNumber = { type: ['number', 'null'] };
export const EXTRACTED_INVOICE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    invoiceNumber: nullableString,
    vendorName: nullableString,
    vendorAddress: nullableString,
    customerName: nullableString,
    issueDate: { ...nullableString, description: 'YYYY-MM-DD' },
    dueDate: { ...nullableString, description: 'YYYY-MM-DD' },
    currency: { ...nullableString, description: 'ISO 4217 code, e.g. EUR' },
    subtotal: nullableNumber,
    tax: nullableNumber,
    total: nullableNumber,
    lineItems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          quantity: nullableNumber,
          unitPrice: nullableNumber,
          amount: nullableNumber,
        },
        required: ['description', 'quantity', 'unitPrice', 'amount'],
      },
    },
  },
  required: [
    'invoiceNumber',
    'vendorName',
    'vendorAddress',
    'customerName',
    'issueDate',
    'dueDate',
    'currency',
    'subtotal',
    'tax',
    'total',
    'lineItems',
  ],
} as const;

/** Fields a user (or the assistant, after confirmation) may correct. */
export const EDITABLE_FIELDS = [
  'invoiceNumber',
  'vendorName',
  'vendorAddress',
  'customerName',
  'issueDate',
  'dueDate',
  'currency',
  'subtotal',
  'tax',
  'total',
] as const;
export type EditableField = (typeof EDITABLE_FIELDS)[number];
export type InvoiceFieldsPatch = Partial<Pick<ExtractedInvoice, EditableField>>;

const close = (a: number, b: number) => Math.abs(a - b) <= 0.02 + Math.abs(b) * 0.001;
const money = (n: number) => n.toFixed(2);

/**
 * Arithmetic and plausibility checks. They never fail processing — the data is still
 * useful — but are shown to the user so a human can double-check the AI's work.
 */
export function sanityCheck(d: ExtractedInvoice): string[] {
  const warnings: string[] = [];
  if (d.total == null) warnings.push('Total amount not found');
  if (!d.invoiceNumber) warnings.push('Invoice number not found');
  if (!d.vendorName) warnings.push('Vendor not found');

  if (d.subtotal != null && d.total != null) {
    if (d.tax != null && !close(d.subtotal + d.tax, d.total)) {
      warnings.push(
        `Subtotal (${money(d.subtotal)}) + tax (${money(d.tax)}) does not equal total (${money(d.total)})`,
      );
    }
    // Missing tax must not silently skip the check: then subtotal alone should match the total.
    if (d.tax == null && !close(d.subtotal, d.total)) {
      warnings.push(
        `Subtotal (${money(d.subtotal)}) does not equal total (${money(d.total)}) and no tax amount was found`,
      );
    }
  }

  const amounts = d.lineItems.map((li) => li.amount).filter((a): a is number => a != null);
  const base = d.subtotal ?? (d.tax == null ? d.total : null);
  if (amounts.length > 0 && base != null) {
    const sum = amounts.reduce((s, a) => s + a, 0);
    if (!close(sum, base)) {
      warnings.push(`Line items add up to ${money(sum)}, expected ${money(base)}`);
    }
  }

  if (d.issueDate && d.dueDate && d.dueDate < d.issueDate) {
    warnings.push('Due date is before the issue date');
  }
  return warnings;
}

/** Columns copied out of the JSON for sorting, filtering and aggregation. */
export function promotedColumns(d: ExtractedInvoice) {
  return {
    vendorName: d.vendorName,
    invoiceNumber: d.invoiceNumber,
    issueDate: d.issueDate ? new Date(`${d.issueDate}T00:00:00Z`) : null,
    total: d.total,
    currency: d.currency,
  };
}
