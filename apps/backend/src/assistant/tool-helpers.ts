import { type Invoice } from '@prisma/client';
import { z } from 'zod';

/** How a tool accepts an invoice: whatever the user is likely to have said. */
export const ref = z
  .string()
  .min(1)
  .describe('Invoice id (UUID), invoice number (e.g. INV-2026-0042) or original file name');

/**
 * What the model sees about an invoice. Raw OCR text is deliberately left out: it is the
 * most likely carrier of prompt-injection text and the extracted fields are enough.
 */
export const compactInvoice = (i: Invoice) => ({
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
});

/** How an invoice is named back to the user — never by its internal id. */
export const label = (i: Invoice) => `${i.invoiceNumber ?? i.originalName}${i.vendorName ? ` (${i.vendorName})` : ''}`;
