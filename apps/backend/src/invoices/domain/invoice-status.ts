import { InvoiceStatus } from '@prisma/client';

export { InvoiceStatus };

/**
 * The only allowed status moves. Everything else is a bug or a race and is rejected.
 *
 *   uploaded ──► processing ──► completed
 *      ▲             │
 *      ├─────────────┤ transient error, automatic retry scheduled
 *      │             ▼
 *      └────────── failed      (manual retry)
 */
const TRANSITIONS: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  uploaded: ['processing'],
  processing: ['completed', 'failed', 'uploaded'],
  completed: [],
  failed: ['uploaded'],
};

export function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: InvoiceStatus,
    readonly to: InvoiceStatus,
  ) {
    super(`Invoice cannot move from "${from}" to "${to}"`);
  }
}

export function assertTransition(from: InvoiceStatus, to: InvoiceStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}
