import { ConflictException } from '@nestjs/common';
import { Invoice } from '@prisma/client';
import { z } from 'zod';
import { EDITABLE_FIELDS, extractedInvoiceSchema } from '../invoices/domain/invoice-data';
import { InvoicesService } from '../invoices/invoices.service';

/**
 * One tool registry, two "doors": the in-app assistant (LLM tool calling) and the MCP
 * server. Tools call the same application service as the UI, so business rules — like
 * "only failed invoices can be retried" — apply to the AI too. No raw SQL access.
 */
export interface AssistantTool<A = Record<string, unknown>> {
  name: string;
  description: string;
  schema: z.ZodType<A>;
  /**
   * Destructive tools are never executed by the in-app assistant: they become a pending
   * action the user confirms with a click (enforced here in code, not by the prompt).
   */
  destructive: boolean;
  /**
   * Arguments that, when present, must come from the user's message — never chosen by the
   * model (an edit value, or a filter like a currency the user didn't ask for).
   */
  userStatedArgs?: string[];
  run(args: A, invoices: InvoicesService): Promise<unknown>;
  /** For destructive tools: what exactly will happen, resolved to a concrete invoice. */
  preview?(args: A, invoices: InvoicesService): Promise<PendingActionPreview>;
}

export interface PendingActionPreview {
  kind: 'delete_invoice' | 'update_invoice_field';
  invoiceId: string;
  summary: string;
  field?: string;
  value?: string | number | null;
}

const ref = z
  .string()
  .min(1)
  .describe('Invoice id (UUID), invoice number (e.g. INV-2026-0042) or original file name');

/**
 * What the model sees about an invoice. Raw OCR text is deliberately left out: it is the
 * most likely carrier of prompt-injection text and the extracted fields are enough.
 */
export function compactInvoice(i: Invoice) {
  return {
    id: i.id,
    file: i.originalName,
    status: i.status,
    invoiceNumber: i.invoiceNumber,
    vendor: i.vendorName,
    issueDate: i.issueDate?.toISOString().slice(0, 10) ?? null,
    total: i.total == null ? null : Number(i.total),
    currency: i.currency,
    warnings: i.warnings,
    error: i.errorReason,
    uploadedAt: i.createdAt.toISOString(),
  };
}

const label = (i: Invoice) => `${i.invoiceNumber ?? i.originalName}${i.vendorName ? ` (${i.vendorName})` : ''}`;

function tool<A>(t: AssistantTool<A>): AssistantTool<A> {
  return t;
}

export const ASSISTANT_TOOLS = [
  tool({
    name: 'list_invoices',
    description:
      'List invoices, newest first. Filter by status, free-text search (file name, vendor, number), vendor, issue date range, or withWarnings (completed invoices whose numbers did not pass the sanity checks).',
    destructive: false,
    schema: z.object({
      status: z.enum(['uploaded', 'processing', 'completed', 'failed']).optional(),
      search: z.string().optional(),
      vendor: z.string().optional(),
      dateFrom: z.string().optional().describe('YYYY-MM-DD, inclusive, on issue date'),
      dateTo: z.string().optional().describe('YYYY-MM-DD, inclusive, on issue date'),
      withWarnings: z.boolean().optional().describe('true = only invoices with warnings'),
      limit: z.number().int().min(1).max(50).optional().describe('Default 10'),
    }),
    run: async (a, invoices) => {
      const { items, total } = await invoices.list({ ...a, limit: a.limit ?? 10 });
      return { total, shown: items.length, items: items.map(compactInvoice) };
    },
  }),
  tool({
    name: 'get_invoice',
    description: 'Get one invoice with its extracted data (line items, dates, totals), warnings and error reason.',
    destructive: false,
    schema: z.object({ ref }),
    run: async (a, invoices) => {
      const i = await invoices.findByRef(a.ref);
      return { ...compactInvoice(i), attempts: i.attempts, extractedData: i.extractedData };
    },
  }),
  tool({
    name: 'get_stats',
    description:
      'Aggregates: count by status, or count and total amount per vendor or per month (completed invoices; totals are per currency).',
    destructive: false,
    userStatedArgs: ['currency'],
    schema: z.object({
      groupBy: z.enum(['status', 'vendor', 'month']),
      currency: z
        .string()
        .optional()
        .describe('Only if the user asked for one currency. Omit it to get totals for all currencies.'),
    }),
    run: (a, invoices) => invoices.stats(a.groupBy, a.currency),
  }),
  tool({
    name: 'retry_invoice',
    description: 'Re-queue one FAILED invoice for processing.',
    destructive: false,
    schema: z.object({ ref }),
    run: async (a, invoices) => {
      const target = await invoices.findByRef(a.ref);
      return compactInvoice(await invoices.retry(target.id));
    },
  }),
  tool({
    name: 'retry_failed_invoices',
    description: 'Re-queue ALL failed invoices for processing.',
    destructive: false,
    schema: z.object({}),
    run: (_a, invoices) => invoices.retryAllFailed(),
  }),
  tool({
    name: 'delete_invoice',
    description: 'Delete one invoice and its file. Requires the user to confirm in the UI.',
    destructive: true,
    schema: z.object({ ref }),
    preview: async (a, invoices) => {
      const i = await invoices.findByRef(a.ref);
      return { kind: 'delete_invoice', invoiceId: i.id, summary: `Delete invoice ${label(i)}` };
    },
    run: async (a, invoices) => {
      const target = await invoices.findByRef(a.ref);
      return { deleted: compactInvoice(await invoices.delete(target.id)) };
    },
  }),
  tool({
    name: 'update_invoice_field',
    description:
      'Correct one extracted header field of a COMPLETED invoice to a value the user explicitly stated (e.g. "set the total to 120"). Line items cannot be edited and fields cannot be cleared. Requires the user to confirm in the UI.',
    destructive: true,
    userStatedArgs: ['value'],
    schema: z.object({
      ref,
      field: z.enum(EDITABLE_FIELDS),
      // No null: the assistant may correct values but not erase them (users can, in the UI).
      value: z
        .union([z.string().min(1), z.number()])
        .describe('The new value the user explicitly gave; dates as YYYY-MM-DD, amounts as numbers'),
    }),
    preview: async (a, invoices) => {
      const i = await invoices.findByRef(a.ref);
      // Normalise through the same schema the service uses, so the preview shows the real value.
      const value = extractedInvoiceSchema.shape[a.field].parse(a.value) as string | number | null;
      if (i.status !== 'completed') {
        throw new ConflictException(`Only completed invoices can be edited (${label(i)} is ${i.status})`);
      }
      const current = ((i.extractedData ?? {}) as Record<string, unknown>)[a.field] ?? null;
      // A no-op edit would ask the user to confirm nothing; tell the model instead.
      if (current === value) {
        throw new ConflictException(
          `${a.field} of ${label(i)} is already ${value ?? '(empty)'} — nothing to change. Line items cannot be edited.`,
        );
      }
      return {
        kind: 'update_invoice_field',
        invoiceId: i.id,
        field: a.field,
        value,
        summary: `Change ${a.field} of ${label(i)} from ${current ?? '(empty)'} to ${value ?? '(empty)'}`,
      };
    },
    run: async (a, invoices) => {
      const target = await invoices.findByRef(a.ref);
      return compactInvoice(await invoices.updateFields(target.id, { [a.field]: a.value }));
    },
  }),
] as AssistantTool[];

export function toolJsonSchema(t: AssistantTool): Record<string, unknown> {
  const { $schema: _ignored, ...schema } = z.toJSONSchema(t.schema) as Record<string, unknown>;
  return schema;
}
