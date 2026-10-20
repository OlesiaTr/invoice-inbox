import { ConflictException } from '@nestjs/common';
import { Client } from 'pg';
import { TransientProcessingError } from '../invoices/domain/processing-errors';
import { createHarness, sample } from '../testing/harness';

const h = createHarness();

beforeEach(() => h.reset());
afterAll(() => h.close());

async function uploadAndRead(file = 'acme-cloud-INV-2026-0042.pdf') {
  const { invoice } = await h.invoices.upload({ buffer: sample(file), originalName: file });
  const [message] = await h.queue.read(30, 1, 1);
  expect(message.payload.invoiceId).toBe(invoice.id);
  return { invoice, message };
}

describe('upload', () => {
  it('stores the row and its job together', async () => {
    const { invoice } = await h.invoices.upload({ buffer: sample('acme-cloud-INV-2026-0042.pdf'), originalName: 'a.pdf' });

    expect(invoice.status).toBe('uploaded');
    expect(h.storage.files.size).toBe(1);
    const messages = await h.queued();
    expect(messages.map((m) => m.message.invoiceId)).toEqual([invoice.id]);
  });

  it('rolls back the row (and removes the file) if enqueueing fails', async () => {
    const enqueue = jest.spyOn(h.queue, 'enqueue').mockRejectedValueOnce(new Error('queue down'));

    await expect(
      h.invoices.upload({ buffer: sample('acme-cloud-INV-2026-0042.pdf'), originalName: 'a.pdf' }),
    ).rejects.toThrow('queue down');
    expect(await h.prisma.invoice.count()).toBe(0);
    expect(h.storage.files.size).toBe(0);
    enqueue.mockRestore();
  });

  it('flags duplicates by content hash', async () => {
    const first = await h.invoices.upload({ buffer: sample('acme-cloud-INV-2026-0042.pdf'), originalName: 'a.pdf' });
    const second = await h.invoices.upload({ buffer: sample('acme-cloud-INV-2026-0042.pdf'), originalName: 'copy.pdf' });
    expect(second.duplicateOf?.id).toBe(first.invoice.id);
  });
});

describe('processing', () => {
  it('extracts, completes and acknowledges the message', async () => {
    const { invoice, message } = await uploadAndRead();

    await expect(h.processor.process(message)).resolves.toBe('completed');

    const done = await h.prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(done).toMatchObject({ status: 'completed', invoiceNumber: 'INV-2026-0042', currency: 'EUR', attempts: 1 });
    expect(Number(done.total)).toBeCloseTo(1106.7);
    expect(done.rawText).toContain('Acme Cloud GmbH');
    expect(await h.queued()).toHaveLength(0);
  });

  it('processes a duplicated delivery only once', async () => {
    const { invoice, message } = await uploadAndRead();
    h.llm.delayMs = 300; // keep the first worker busy while the duplicate arrives

    const outcomes = await Promise.all([h.processor.process(message), h.processor.process({ ...message })]);

    expect(outcomes.sort()).toEqual(['busy_elsewhere', 'completed']);
    expect(h.llm.calls).toBe(1);
    expect((await h.prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).attempts).toBe(1);
  });

  it('drops a duplicate that arrives after completion', async () => {
    const { message } = await uploadAndRead();
    await h.processor.process(message);
    await expect(h.processor.process(message)).resolves.toBe('duplicate');
    expect(h.llm.calls).toBe(1);
  });

  it('takes over a job whose worker died (expired lease)', async () => {
    const { invoice, message } = await uploadAndRead();
    await h.prisma.$executeRaw`
      UPDATE invoices SET status = 'processing', processing_started_at = now() - interval '1 hour'
      WHERE id = ${invoice.id}::uuid`;

    await expect(h.processor.process(message)).resolves.toBe('completed');
  });

  it('schedules a retry with backoff on transient errors, then fails after the last attempt', async () => {
    const { invoice, message } = await uploadAndRead();
    h.llm.failWith = new TransientProcessingError('model timeout');

    await expect(h.processor.process(message)).resolves.toBe('retry_scheduled');
    let row = await h.prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(row.status).toBe('uploaded');
    expect(row.errorReason).toMatch(/Attempt 1 of 3 failed: .*model timeout.*Retrying in 10s/);
    const [queued] = await h.queued();
    expect(queued.vt.getTime()).toBeGreaterThan(Date.now() + 5000); // hidden for the backoff

    await expect(h.processor.process({ ...message, readCount: 3 })).resolves.toBe('failed');
    row = await h.prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(row.status).toBe('failed');
    expect(row.errorReason).toMatch(/Failed after 3 attempts/);
    expect(await h.queued()).toHaveLength(0);
  });

  it('fails immediately on permanent errors', async () => {
    const { invoice, message } = await uploadAndRead('corrupted.pdf');

    await expect(h.processor.process(message)).resolves.toBe('failed');
    const row = await h.prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(row.errorReason).toMatch(/Could not read the PDF/);
    expect(h.llm.calls).toBe(0);
    expect(await h.queued()).toHaveLength(0);
  });

  it('dead-letters a message that keeps crashing workers', async () => {
    const { invoice, message } = await uploadAndRead();

    await expect(h.processor.process({ ...message, readCount: 5 })).resolves.toBe('dead_lettered');
    expect((await h.prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).toBe('failed');
    expect(await h.queued()).toHaveLength(0);
    expect(await h.queued('invoice_processing_dlq')).toHaveLength(1);
  });

  it('acknowledges the message if the invoice was deleted mid-flight', async () => {
    const { invoice, message } = await uploadAndRead();
    await h.invoices.delete(invoice.id);
    await expect(h.processor.process(message)).resolves.toBe('duplicate');
    expect(await h.queued()).toHaveLength(0);
  });
});

describe('manual retry', () => {
  it('re-queues a failed invoice', async () => {
    const { invoice, message } = await uploadAndRead('corrupted.pdf');
    await h.processor.process(message);

    const retried = await h.invoices.retry(invoice.id);
    expect(retried).toMatchObject({ status: 'uploaded', errorReason: null });
    expect((await h.queued()).map((m) => m.message.invoiceId)).toEqual([invoice.id]);
  });

  it('refuses to retry anything that is not failed', async () => {
    const { invoice } = await uploadAndRead();
    await expect(h.invoices.retry(invoice.id)).rejects.toBeInstanceOf(ConflictException);
  });

  it('enqueues once even if retry is clicked twice at the same time', async () => {
    const { invoice, message } = await uploadAndRead('corrupted.pdf');
    await h.processor.process(message);

    const results = await Promise.allSettled([h.invoices.retry(invoice.id), h.invoices.retry(invoice.id)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await h.queued()).toHaveLength(1);
  });
});

describe('invoice_events trigger', () => {
  it('announces committed changes only', async () => {
    const listener = new Client({ connectionString: process.env.DIRECT_URL });
    await listener.connect();
    const events: { type: string; id: string; status: string }[] = [];
    listener.on('notification', (n) => events.push(JSON.parse(n.payload!)));
    await listener.query('LISTEN invoice_events');

    const { invoice } = await h.invoices.upload({ buffer: sample('acme-cloud-INV-2026-0042.pdf'), originalName: 'a.pdf' });
    await h.prisma
      .$transaction(async (tx) => {
        await tx.invoice.update({ where: { id: invoice.id }, data: { status: 'processing' } });
        throw new Error('rollback');
      })
      .catch(() => undefined);
    await new Promise((r) => setTimeout(r, 200));
    await listener.end();

    expect(events).toEqual([expect.objectContaining({ type: 'INSERT', id: invoice.id, status: 'uploaded' })]);
  });
});
