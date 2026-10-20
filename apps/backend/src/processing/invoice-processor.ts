import { Inject, Injectable, Logger } from '@nestjs/common';
import { Invoice, Prisma } from '@prisma/client';
import { z } from 'zod';
import { APP_CONFIG, type AppConfig } from '../config/config';
import {
  extractedInvoiceSchema,
  promotedColumns,
  sanityCheck,
} from '../invoices/domain/invoice-data';
import {
  PermanentProcessingError,
  TransientProcessingError,
  errorMessage,
} from '../invoices/domain/processing-errors';
import { LlmClient } from '../llm/llm-client';
import { PrismaService } from '../prisma/prisma.service';
import { InvoiceJob, JobQueue, QueueMessage } from '../queue/job-queue';
import { FileStorage } from '../storage/file-storage';
import { TextExtractor } from './text-extractor';

export type ProcessOutcome =
  | 'completed'
  | 'failed'
  | 'retry_scheduled'
  | 'duplicate'
  | 'busy_elsewhere'
  | 'dead_lettered';

/**
 * Handles one queue message. Delivery is at-least-once, so every step is written to be
 * safe when the same message arrives twice or a previous worker died half-way.
 */
@Injectable()
export class InvoiceProcessor {
  private readonly logger = new Logger(InvoiceProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: JobQueue,
    private readonly storage: FileStorage,
    private readonly extractor: TextExtractor,
    private readonly llm: LlmClient,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async process(message: QueueMessage<InvoiceJob>): Promise<ProcessOutcome> {
    const { invoiceId } = message.payload;
    const maxAttempts = this.config.MAX_PROCESSING_ATTEMPTS;

    // Read more times than we ever retry → previous workers crashed before recording
    // anything (e.g. out of memory on this file). Stop the loop: dead-letter it.
    if (message.readCount > maxAttempts + 1) {
      await this.prisma.$transaction(async (tx) => {
        await this.queue.deadLetter(tx, message);
        await tx.invoice.updateMany({
          where: { id: invoiceId, status: { in: ['uploaded', 'processing'] } },
          data: {
            status: 'failed',
            errorReason: 'Processing crashed repeatedly; the job was moved to the dead-letter queue.',
            processingStartedAt: null,
          },
        });
      });
      return 'dead_lettered';
    }

    const invoice = await this.claim(invoiceId);
    if (!invoice) return this.handleUnclaimed(message);

    let rawText: string | undefined;
    try {
      const file = await this.storage.get(invoice.storageKey);
      rawText = await this.extractor.extract(file, invoice.mimeType);
      const parsed = extractedInvoiceSchema.safeParse(await this.llm.extractInvoice(rawText));
      if (!parsed.success) {
        // Model output varies between runs, so a malformed answer is worth retrying.
        throw new TransientProcessingError(
          `The model's answer did not match the invoice schema: ${z.prettifyError(parsed.error)}`,
        );
      }
      const data = parsed.data;

      await this.prisma.$transaction(async (tx) => {
        // Conditional on still owning the job: if the invoice was deleted meanwhile,
        // this matches nothing and we just acknowledge the message.
        await tx.invoice.updateMany({
          where: { id: invoiceId, status: 'processing' },
          data: {
            status: 'completed',
            completedAt: new Date(),
            processingStartedAt: null,
            errorReason: null,
            rawText,
            extractedData: data as Prisma.InputJsonValue,
            warnings: sanityCheck(data),
            ...promotedColumns(data),
          },
        });
        await this.queue.delete(tx, message.id);
      });
      return 'completed';
    } catch (err) {
      return this.handleFailure(invoiceId, message, err, rawText);
    }
  }

  /**
   * Atomic compare-and-set: only one worker can move the invoice to `processing`.
   * A `processing` row whose lease expired belonged to a worker that died — take it over.
   */
  private async claim(invoiceId: string): Promise<Invoice | null> {
    const lease = this.config.QUEUE_VISIBILITY_TIMEOUT_SECONDS;
    const claimed = await this.prisma.$executeRaw`
      UPDATE invoices
      SET status = 'processing', processing_started_at = now(), attempts = attempts + 1, updated_at = now()
      WHERE id = ${invoiceId}::uuid
        AND (status = 'uploaded'
             OR (status = 'processing' AND processing_started_at < now() - make_interval(secs => ${lease})))`;
    return claimed === 1 ? this.prisma.invoice.findUnique({ where: { id: invoiceId } }) : null;
  }

  private async handleUnclaimed(message: QueueMessage<InvoiceJob>): Promise<ProcessOutcome> {
    const current = await this.prisma.invoice.findUnique({
      where: { id: message.payload.invoiceId },
      select: { status: true },
    });
    if (current?.status === 'processing') {
      // Another worker holds a fresh lease. Keep the message: if that worker dies,
      // this message is what brings the job back. Check again after the lease.
      await this.queue.setVisibility(this.prisma, message.id, this.config.QUEUE_VISIBILITY_TIMEOUT_SECONDS);
      return 'busy_elsewhere';
    }
    // Deleted, or already completed/failed: a duplicate delivery.
    await this.queue.delete(this.prisma, message.id);
    return 'duplicate';
  }

  private async handleFailure(
    invoiceId: string,
    message: QueueMessage<InvoiceJob>,
    err: unknown,
    rawText: string | undefined,
  ): Promise<ProcessOutcome> {
    const reason = errorMessage(err);
    const maxAttempts = this.config.MAX_PROCESSING_ATTEMPTS;
    const permanent = err instanceof PermanentProcessingError;
    const exhausted = message.readCount >= maxAttempts;
    this.logger.warn(
      `Invoice ${invoiceId} attempt ${message.readCount}/${maxAttempts} failed (${permanent ? 'permanent' : 'transient'}): ${reason}`,
    );

    if (permanent || exhausted) {
      await this.prisma.$transaction(async (tx) => {
        await tx.invoice.updateMany({
          where: { id: invoiceId, status: 'processing' },
          data: {
            status: 'failed',
            processingStartedAt: null,
            errorReason: permanent ? reason : `Failed after ${maxAttempts} attempts. Last error: ${reason}`,
            rawText,
          },
        });
        await this.queue.delete(tx, message.id);
      });
      return 'failed';
    }

    // Transient: back to the queue with exponential backoff (10s, 20s, 40s...).
    const delay = 10 * 2 ** (message.readCount - 1);
    await this.prisma.$transaction(async (tx) => {
      await tx.invoice.updateMany({
        where: { id: invoiceId, status: 'processing' },
        data: {
          status: 'uploaded',
          processingStartedAt: null,
          errorReason: `Attempt ${message.readCount} of ${maxAttempts} failed: ${reason}. Retrying in ${delay}s.`,
        },
      });
      await this.queue.setVisibility(tx, message.id, delay);
    });
    return 'retry_scheduled';
  }
}
