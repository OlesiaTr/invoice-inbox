import type { Tx } from '../prisma/prisma.service';

export interface InvoiceJob {
  invoiceId: string;
}

export interface QueueMessage<T> {
  id: bigint;
  /** How many times this message has been read — SQS's ApproximateReceiveCount. */
  readCount: number;
  payload: T;
}

/**
 * Port for the processing queue. Every write takes a transaction client so enqueueing
 * (or acknowledging) happens atomically with the business data change it belongs to.
 */
export abstract class JobQueue {
  abstract enqueue(tx: Tx, job: InvoiceJob, delaySeconds?: number): Promise<void>;

  /** Long-polls for up to `waitSeconds`; returned messages stay hidden for `visibilitySeconds`. */
  abstract read(
    visibilitySeconds: number,
    max: number,
    waitSeconds: number,
  ): Promise<QueueMessage<InvoiceJob>[]>;

  /** Acknowledge: the message is done and must not be delivered again. */
  abstract delete(tx: Tx, messageId: bigint): Promise<void>;

  /** Hide the message again for `seconds` (backoff, or "someone else is on it"). */
  abstract setVisibility(tx: Tx, messageId: bigint, seconds: number): Promise<void>;

  /** Move a poison message to the dead-letter queue. */
  abstract deadLetter(tx: Tx, message: QueueMessage<InvoiceJob>): Promise<void>;
}
