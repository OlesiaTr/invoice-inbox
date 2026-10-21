import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from '../config/config';
import { InvoicesService } from '../invoices/invoices.service';
import { LlmClient } from '../llm/llm-client';
import { MockLlmClient } from '../llm/mock-llm-client';
import { InvoiceProcessor } from '../processing/invoice-processor';
import { TextExtractor } from '../processing/text-extractor';
import { PrismaService } from '../prisma/prisma.service';
import { PgmqJobQueue, QUEUE_NAME, DEAD_LETTER_QUEUE_NAME } from '../queue/pgmq-job-queue';
import { FileNotFoundError, FileStorage } from '../storage/file-storage';

export class MemoryStorage extends FileStorage {
  readonly files = new Map<string, Buffer>();
  async put(key: string, body: Buffer) {
    this.files.set(key, body);
  }
  async get(key: string) {
    const f = this.files.get(key);
    // Same signal the real adapters raise, so callers behave the same way under test.
    if (!f) throw new FileNotFoundError(key);
    return f;
  }
  async delete(key: string) {
    this.files.delete(key);
  }
}

/** Counts extraction calls and can be slowed down to widen race windows. */
export class CountingLlm extends LlmClient {
  calls = 0;
  delayMs = 0;
  failWith?: Error;
  private readonly mock = new MockLlmClient();
  async extractInvoice(text: string) {
    this.calls++;
    if (this.delayMs) await new Promise((r) => setTimeout(r, this.delayMs));
    if (this.failWith) throw this.failWith;
    return this.mock.extractInvoice(text);
  }
  chat = this.mock.chat.bind(this.mock);
}

export const sample = (name: string) => readFileSync(join(__dirname, '../../../../samples', name));

/** Real Postgres + pgmq, real queue and services; only storage and the model are faked. */
export const createHarness = () => {
  const config = loadConfig({
    ...process.env,
    MAX_PROCESSING_ATTEMPTS: '3',
    QUEUE_VISIBILITY_TIMEOUT_SECONDS: '30',
  });
  const prisma = new PrismaService();
  const queue = new PgmqJobQueue(prisma);
  const storage = new MemoryStorage();
  const llm = new CountingLlm();
  const extractor = new TextExtractor();
  const invoices = new InvoicesService(prisma, queue, storage, config);
  const processor = new InvoiceProcessor(prisma, queue, storage, extractor, llm, config);

  return {
    config,
    prisma,
    queue,
    storage,
    llm,
    invoices,
    processor,
    async reset() {
      await prisma.$executeRawUnsafe('TRUNCATE invoices');
      await prisma.$queryRaw`SELECT pgmq.purge_queue(${QUEUE_NAME}::text)`;
      await prisma.$queryRaw`SELECT pgmq.purge_queue(${DEAD_LETTER_QUEUE_NAME}::text)`;
      storage.files.clear();
      llm.calls = 0;
      llm.delayMs = 0;
      llm.failWith = undefined;
    },
    /** Messages currently in a queue, visible or not. */
    async queued(queueName = QUEUE_NAME) {
      return prisma.$queryRawUnsafe<{ msg_id: bigint; read_ct: number; vt: Date; message: { invoiceId: string } }[]>(
        `SELECT msg_id, read_ct, vt, message FROM pgmq.q_${queueName} ORDER BY msg_id`,
      );
    },
    async close() {
      await extractor.onModuleDestroy();
      await prisma.$disconnect();
    },
  };
};
