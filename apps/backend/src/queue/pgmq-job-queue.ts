import { Injectable } from '@nestjs/common';
import { PrismaService, type Tx } from '../prisma/prisma.service';
import { InvoiceJob, JobQueue, QueueMessage } from './job-queue';

export const QUEUE_NAME = 'invoice_processing';
export const DEAD_LETTER_QUEUE_NAME = 'invoice_processing_dlq';

interface PgmqRow {
  msg_id: bigint;
  read_ct: number;
  message: InvoiceJob;
}

/** pgmq (Postgres message queue, a.k.a. Supabase Queues) — SQS semantics inside Postgres. */
@Injectable()
export class PgmqJobQueue extends JobQueue {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async enqueue(tx: Tx, job: InvoiceJob, delaySeconds = 0): Promise<void> {
    await tx.$queryRaw`SELECT pgmq.send(${QUEUE_NAME}::text, ${JSON.stringify(job)}::jsonb, ${delaySeconds}::int)`;
  }

  async read(visibilitySeconds: number, max: number, waitSeconds: number) {
    const rows = await this.prisma.$queryRaw<PgmqRow[]>`
      SELECT msg_id, read_ct, message
      FROM pgmq.read_with_poll(${QUEUE_NAME}::text, ${visibilitySeconds}::int, ${max}::int, ${waitSeconds}::int, 250)`;
    return rows.map((r): QueueMessage<InvoiceJob> => ({ id: r.msg_id, readCount: r.read_ct, payload: r.message }));
  }

  async delete(tx: Tx, messageId: bigint): Promise<void> {
    await tx.$queryRaw`SELECT pgmq.delete(${QUEUE_NAME}::text, ${messageId}::bigint)`;
  }

  async setVisibility(tx: Tx, messageId: bigint, seconds: number): Promise<void> {
    await tx.$queryRaw`SELECT msg_id FROM pgmq.set_vt(${QUEUE_NAME}::text, ${messageId}::bigint, ${seconds}::int)`;
  }

  async deadLetter(tx: Tx, message: QueueMessage<InvoiceJob>): Promise<void> {
    const body = JSON.stringify({ ...message.payload, originalMessageId: String(message.id) });
    await tx.$queryRaw`SELECT pgmq.send(${DEAD_LETTER_QUEUE_NAME}::text, ${body}::jsonb)`;
    await this.delete(tx, message.id);
  }
}
