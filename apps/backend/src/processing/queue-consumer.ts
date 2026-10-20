import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { runWithContext } from '../common/request-context';
import { APP_CONFIG, type AppConfig } from '../config/config';
import { errorMessage } from '../invoices/domain/processing-errors';
import { JobQueue } from '../queue/job-queue';
import { InvoiceProcessor } from './invoice-processor';

/**
 * Runs WORKER_CONCURRENCY independent poll loops. Scaling out = more worker processes;
 * the queue hands each message to one reader at a time.
 */
@Injectable()
export class QueueConsumer implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(QueueConsumer.name);
  private stopping = false;
  private loops: Promise<void>[] = [];

  constructor(
    private readonly queue: JobQueue,
    private readonly processor: InvoiceProcessor,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  onApplicationBootstrap() {
    const n = this.config.WORKER_CONCURRENCY;
    this.logger.log(`Starting ${n} queue consumer loop(s)`);
    this.loops = Array.from({ length: n }, (_, i) => this.loop(i));
  }

  /**
   * Graceful shutdown: stop polling and let in-flight jobs finish before the DB connection
   * closes (Nest runs onModuleDestroy before the Prisma disconnect).
   */
  async onModuleDestroy() {
    this.stopping = true;
    await Promise.allSettled(this.loops);
  }

  private async loop(index: number): Promise<void> {
    while (!this.stopping) {
      try {
        const messages = await this.queue.read(this.config.QUEUE_VISIBILITY_TIMEOUT_SECONDS, 1, 5);
        for (const message of messages) {
          // One context per message: every line the processor logs carries the invoice id
          // and a shared correlation id, so a job's whole journey is one grep.
          await runWithContext({ invoiceId: message.payload.invoiceId }, async () => {
            const outcome = await this.processor.process(message);
            this.logger.log(`[loop ${index}] invoice ${message.payload.invoiceId}: ${outcome}`);
          });
        }
      } catch (err) {
        // Unexpected (e.g. DB down). The message, if any, stays in the queue and reappears.
        this.logger.error(`[loop ${index}] ${errorMessage(err)}`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }
}
