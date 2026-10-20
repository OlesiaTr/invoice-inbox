import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export interface RequestContext {
  /** Correlates every log line emitted while handling one request or one queue message. */
  correlationId: string;
  /** Set on worker jobs, so an invoice's whole journey can be grepped out of the logs. */
  invoiceId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Ambient per-unit-of-work context. The alternative — threading a correlation id through
 * every service signature — would touch code that has no other reason to know about it.
 */
export function runWithContext<T>(ctx: Partial<RequestContext>, fn: () => T): T {
  return storage.run({ correlationId: ctx.correlationId ?? randomUUID(), invoiceId: ctx.invoiceId }, fn);
}

export function currentContext(): RequestContext | undefined {
  return storage.getStore();
}
