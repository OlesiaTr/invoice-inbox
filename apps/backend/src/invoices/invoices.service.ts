import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Invoice, InvoiceStatus, Prisma } from '@prisma/client';
import { APP_CONFIG, type AppConfig } from '../config/config';
import { PrismaService } from '../prisma/prisma.service';
import { JobQueue } from '../queue/job-queue';
import { FileStorage } from '../storage/file-storage';
import { EXTENSIONS, detectFileType } from './domain/file-type';
import {
  InvoiceFieldsPatch,
  extractedInvoiceSchema,
  promotedColumns,
  sanityCheck,
} from './domain/invoice-data';
import { assertTransition, InvalidTransitionError } from './domain/invoice-status';

export interface UploadedFile {
  buffer: Buffer;
  originalName: string;
  /** Same key on a retry → the first upload's invoice is returned, nothing is created twice. */
  idempotencyKey?: string;
}

export type SortField = 'createdAt' | 'issueDate' | 'total' | 'vendorName';

export interface ListInvoicesQuery {
  status?: InvoiceStatus;
  search?: string;
  vendor?: string;
  dateFrom?: string;
  dateTo?: string;
  /** Only invoices whose sanity checks produced warnings. */
  withWarnings?: boolean;
  sortBy?: SortField;
  sortDir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export type StatsGroupBy = 'status' | 'vendor' | 'month';

/** Application service: the one place business rules live. GraphQL, REST, the assistant and MCP all call this. */
@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: JobQueue,
    private readonly storage: FileStorage,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async upload(file: UploadedFile): Promise<{ invoice: Invoice; duplicateOf: Invoice | null }> {
    // Replay: the first attempt committed but its response was lost (e.g. API restart).
    if (file.idempotencyKey) {
      const existing = await this.prisma.invoice.findUnique({ where: { idempotencyKey: file.idempotencyKey } });
      if (existing) return { invoice: existing, duplicateOf: null };
    }
    if (file.buffer.length === 0) throw new BadRequestException('The file is empty');
    if (file.buffer.length > this.config.MAX_UPLOAD_BYTES) {
      throw new PayloadTooLargeException(`Files up to ${this.config.MAX_UPLOAD_BYTES / 1024 / 1024} MB are accepted`);
    }
    const mimeType = detectFileType(file.buffer);
    if (!mimeType) throw new BadRequestException('Only PDF, PNG, JPEG and WEBP files are supported');

    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const duplicateOf = await this.prisma.invoice.findFirst({ where: { sha256 }, orderBy: { createdAt: 'asc' } });

    const id = randomUUID();
    const storageKey = `invoices/${id}.${EXTENSIONS[mimeType]}`;
    await this.storage.put(storageKey, file.buffer, mimeType);

    try {
      // Row and queue message commit together — no invoice can be left without a job.
      const invoice = await this.prisma.$transaction(async (tx) => {
        const created = await tx.invoice.create({
          data: {
            id,
            originalName: file.originalName.slice(0, 255),
            mimeType,
            sizeBytes: file.buffer.length,
            storageKey,
            sha256,
            idempotencyKey: file.idempotencyKey,
          },
        });
        await this.queue.enqueue(tx, { invoiceId: id });
        return created;
      });
      return { invoice, duplicateOf };
    } catch (err) {
      await this.storage.delete(storageKey).catch(() => undefined);
      // Two attempts with the same key raced: the other one won, return its invoice.
      if (file.idempotencyKey && err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await this.prisma.invoice.findUnique({ where: { idempotencyKey: file.idempotencyKey } });
        if (existing) return { invoice: existing, duplicateOf: null };
      }
      throw err;
    }
  }

  async list(q: ListInvoicesQuery) {
    const where: Prisma.InvoiceWhereInput = {
      status: q.status,
      warnings: q.withWarnings ? { isEmpty: false } : undefined,
      vendorName: q.vendor ? { contains: q.vendor, mode: 'insensitive' } : undefined,
      issueDate:
        q.dateFrom || q.dateTo
          ? { gte: q.dateFrom ? new Date(q.dateFrom) : undefined, lte: q.dateTo ? new Date(q.dateTo) : undefined }
          : undefined,
      OR: q.search
        ? [
            { originalName: { contains: q.search, mode: 'insensitive' } },
            { vendorName: { contains: q.search, mode: 'insensitive' } },
            { invoiceNumber: { contains: q.search, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const sortBy = q.sortBy ?? 'createdAt';
    const sortDir = q.sortDir ?? 'desc';
    const [items, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        orderBy: [
          // Nullable (extracted) columns: invoices still processing sort last either way.
          sortBy === 'createdAt' ? { createdAt: sortDir } : { [sortBy]: { sort: sortDir, nulls: 'last' } },
          { createdAt: 'desc' },
        ],
        take: Math.min(q.limit ?? 50, 200),
        skip: q.offset ?? 0,
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return { items, total };
  }

  async statusCounts(): Promise<Record<InvoiceStatus, number>> {
    const rows = await this.prisma.invoice.groupBy({ by: ['status'], _count: { _all: true } });
    const counts = { uploaded: 0, processing: 0, completed: 0, failed: 0 };
    for (const r of rows) counts[r.status] = r._count._all;
    return counts;
  }

  async get(id: string): Promise<Invoice> {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException(`Invoice ${id} not found`);
    return invoice;
  }

  /** Finds by UUID or by (extracted) invoice number — the assistant gets either from users. */
  async findByRef(ref: string): Promise<Invoice> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref);
    const matches = await this.prisma.invoice.findMany({
      where: isUuid
        ? { id: ref }
        : { OR: [{ invoiceNumber: { equals: ref, mode: 'insensitive' } }, { originalName: { equals: ref, mode: 'insensitive' } }] },
      take: 2,
    });
    if (matches.length === 0) throw new NotFoundException(`No invoice matches "${ref}"`);
    if (matches.length > 1) throw new ConflictException(`More than one invoice matches "${ref}"; use its id`);
    return matches[0];
  }

  async getFile(id: string): Promise<{ invoice: Invoice; body: Buffer }> {
    const invoice = await this.get(id);
    return { invoice, body: await this.storage.get(invoice.storageKey) };
  }

  /** Manual retry: only from `failed`. Status reset and new job commit together. */
  async retry(id: string): Promise<Invoice> {
    const invoice = await this.get(id);
    try {
      assertTransition(invoice.status, 'uploaded');
    } catch (err) {
      if (err instanceof InvalidTransitionError) {
        throw new ConflictException(`Only failed invoices can be retried (this one is ${invoice.status})`);
      }
      throw err;
    }
    return this.prisma.$transaction(async (tx) => {
      // Conditional again: guards against two concurrent retry clicks enqueueing twice.
      const { count } = await tx.invoice.updateMany({
        where: { id, status: 'failed' },
        data: { status: 'uploaded', errorReason: null },
      });
      if (count === 0) throw new ConflictException('The invoice is no longer in the failed state');
      await this.queue.enqueue(tx, { invoiceId: id });
      return tx.invoice.findUniqueOrThrow({ where: { id } });
    });
  }

  async retryAllFailed(): Promise<{ retried: number }> {
    return this.prisma.$transaction(async (tx) => {
      const failed = await tx.invoice.findMany({ where: { status: 'failed' }, select: { id: true } });
      if (failed.length === 0) return { retried: 0 };
      await tx.invoice.updateMany({
        where: { id: { in: failed.map((f) => f.id) }, status: 'failed' },
        data: { status: 'uploaded', errorReason: null },
      });
      for (const { id } of failed) await this.queue.enqueue(tx, { invoiceId: id });
      return { retried: failed.length };
    });
  }

  async delete(id: string): Promise<Invoice> {
    const invoice = await this.get(id);
    // A worker mid-job will find the row gone and simply acknowledge its message.
    await this.prisma.invoice.delete({ where: { id } });
    await this.storage.delete(invoice.storageKey).catch((err) => {
      this.logger.warn(`Orphaned file ${invoice.storageKey}: ${err}`);
    });
    return invoice;
  }

  /** Human correction of extracted fields; warnings are recomputed from the new values. */
  async updateFields(id: string, patch: InvoiceFieldsPatch): Promise<Invoice> {
    const invoice = await this.get(id);
    if (invoice.status !== 'completed') {
      throw new ConflictException('Only completed invoices can be edited');
    }
    const merged = extractedInvoiceSchema.parse({ ...(invoice.extractedData as object), ...patch });
    return this.prisma.invoice.update({
      where: { id },
      data: {
        extractedData: merged as Prisma.InputJsonValue,
        warnings: sanityCheck(merged),
        ...promotedColumns(merged),
      },
    });
  }

  async stats(groupBy: StatsGroupBy, currency?: string) {
    if (groupBy === 'status') return { byStatus: await this.statusCounts() };

    const key = groupBy === 'vendor' ? Prisma.sql`vendor_name` : Prisma.sql`to_char(issue_date, 'YYYY-MM')`;
    const rows = await this.prisma.$queryRaw<{ key: string | null; currency: string | null; count: bigint; total: Prisma.Decimal | null }[]>`
      SELECT ${key} AS key, currency, count(*) AS count, sum(total) AS total
      FROM invoices
      WHERE status = 'completed' ${currency ? Prisma.sql`AND currency = ${currency.toUpperCase()}` : Prisma.empty}
      GROUP BY 1, 2
      ORDER BY 4 DESC NULLS LAST
      LIMIT 50`;
    return {
      groupBy,
      // Totals are per currency — adding EUR to USD would be meaningless.
      rows: rows.map((r) => ({
        [groupBy]: r.key ?? '(unknown)',
        currency: r.currency ?? '(unknown)',
        invoices: Number(r.count),
        total: r.total == null ? null : Number(r.total),
      })),
    };
  }
}
