import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getOptionsToken } from '@nestjs/throttler';
import { createClient } from 'graphql-ws';
import request from 'supertest';
import { WebSocket } from 'ws';
import { ApiModule } from '../../api.module';
import { LlmClient } from '../../llm/llm-client';
import { PrismaService } from '../../prisma/prisma.service';
import { FileStorage } from '../../storage/file-storage';
import { CountingLlm, MemoryStorage, sample } from '../../testing/harness';

/**
 * The HTTP and GraphQL surface against a real Nest app and a real database — the layer the
 * unit specs and the processing integration spec both sit below. Only the two outbound
 * adapters are faked, so guards, pipes, filters and the throttler are all exercised.
 */
describe('invoices API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ApiModule] })
      .overrideProvider(FileStorage)
      .useClass(MemoryStorage)
      .overrideProvider(LlmClient)
      .useClass(CountingLlm)
      // A tiny budget so the 429 path is reachable without sending hundreds of requests.
      .overrideProvider(getOptionsToken())
      .useValue([{ name: 'default', ttl: 60_000, limit: 5 }])
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE invoices');
  });

  const upload = (key?: string) => {
    const req = request(app.getHttpServer())
      .post('/api/invoices')
      .attach('file', sample('acme-cloud-INV-2026-0042.pdf'), 'acme.pdf');
    return key ? req.set('Idempotency-Key', key) : req;
  };

  const graphql = (query: string, variables?: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/graphql').send({ query, variables });

  it('accepts a PDF upload and queues it', async () => {
    const res = await upload('e2e-upload-0001');
    expect(res.status).toBe(201);
    expect(res.body.invoice).toMatchObject({ originalName: 'acme.pdf', status: 'uploaded' });
    expect(res.body.duplicateOf).toBeNull();
  });

  it('returns the first invoice when the same Idempotency-Key is replayed', async () => {
    const first = await upload('e2e-idem-0002');
    const second = await upload('e2e-idem-0002');
    expect(second.body.invoice.id).toBe(first.body.invoice.id);
    await expect(prisma.invoice.count()).resolves.toBe(1);
  });

  it('flags a byte-identical re-upload as a duplicate without refusing it', async () => {
    await upload('e2e-dup-0003-a');
    const res = await upload('e2e-dup-0003-b');
    expect(res.status).toBe(201);
    expect(res.body.duplicateOf).toMatchObject({ originalName: 'acme.pdf' });
  });

  it('rejects a file whose bytes are not a supported type', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/invoices')
      .attach('file', Buffer.from('this is not a pdf'), 'fake.pdf');
    expect(res.status).toBe(400);
    // The exception filter adds the id without swallowing the explanation.
    expect(res.body.message).toMatch(/PDF, PNG, JPEG and WEBP/);
    expect(res.body.correlationId).toBeDefined();
  });

  // Regression: the row outliving its file surfaced as an unhandled 500, which rendered
  // as raw error JSON inside the detail sheet's preview frame.
  it('says so plainly when the invoice exists but its file is gone', async () => {
    const { body } = await upload('e2e-missing-file-0008');
    const storage = app.get<MemoryStorage>(FileStorage);
    storage.files.clear();

    const res = await request(app.getHttpServer()).get(`/api/invoices/${body.invoice.id}/file`);
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/no longer available/);
  });

  it('serves a 404 with a correlation id for an unknown invoice', async () => {
    const res = await request(app.getHttpServer()).get('/api/invoices/11111111-1111-1111-1111-111111111111/file');
    expect(res.status).toBe(404);
    expect(res.body.correlationId).toBeDefined();
  });

  it('echoes back a correlation id the client supplied', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').set('x-request-id', 'trace-from-client');
    expect(res.headers['x-request-id']).toBe('trace-from-client');
  });

  it('lists uploaded invoices over GraphQL', async () => {
    await upload('e2e-list-0004');
    const res = await graphql('{ invoices { total items { originalName status } } }');
    expect(res.body.data.invoices.total).toBe(1);
    expect(res.body.data.invoices.items[0]).toMatchObject({ originalName: 'acme.pdf', status: 'uploaded' });
  });

  // Regression: these reached Prisma unchanged, and a negative skip is an error there.
  it('clamps out-of-range pagination instead of failing the query', async () => {
    await upload('e2e-clamp-0005');
    const res = await graphql('query($f: InvoicesFilter){ invoices(filter: $f) { total items { id } } }', {
      f: { offset: -1, limit: 0 },
    });
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.invoices.items).toHaveLength(1);
  });

  it('refuses to retry an invoice that has not failed', async () => {
    const { body } = await upload('e2e-retry-0006');
    const res = await graphql('mutation($id: ID!){ retryInvoice(id: $id) { id } }', { id: body.invoice.id });
    expect(res.body.errors[0].message).toMatch(/Only failed invoices can be retried/);
  });

  it('deletes an invoice over GraphQL', async () => {
    const { body } = await upload('e2e-delete-0007');
    const res = await graphql('mutation($id: ID!){ deleteInvoice(id: $id) { id } }', { id: body.invoice.id });
    expect(res.body.data.deleteInvoice.id).toBe(body.invoice.id);
    await expect(prisma.invoice.count()).resolves.toBe(0);
  });

  it('rejects an assistant turn that is too large to forward to the model', async () => {
    const res = await graphql('mutation($m:[ChatMessageInput!]!){ assistantChat(messages:$m){ reply } }', {
      m: [{ role: 'user', content: 'x'.repeat(5000) }],
    });
    expect(res.body.errors[0].message).toMatch(/at most 4000 characters/);
  });

  /**
   * Regression: the throttler guard tried to write rate-limit headers onto a response a
   * WebSocket doesn't have, so every subscription died with "Cannot read properties of
   * undefined (reading 'header')" — the UI silently stopped updating live.
   */
  it('delivers invoice events over a WebSocket subscription', async () => {
    await app.listen(0);
    const port = (app.getHttpServer().address() as { port: number }).port;
    const client = createClient({ url: `ws://localhost:${port}/graphql`, webSocketImpl: WebSocket });

    const events: { type: string; status: string | null }[] = [];
    const firstEvent = new Promise<void>((resolve, reject) => {
      client.subscribe(
        { query: 'subscription InvoiceEvents { invoiceEvents { type id status updatedAt } }' },
        {
          next: ({ data, errors }: { data?: any; errors?: readonly { message: string }[] }) => {
            if (errors?.length) return reject(new Error(errors[0].message));
            events.push(data.invoiceEvents);
            resolve();
          },
          error: (err: unknown) => reject(err instanceof Error ? err : new Error(JSON.stringify(err))),
          complete: () => undefined,
        },
      );
    });

    // Give the subscription a moment to register before the insert that should wake it.
    await new Promise((r) => setTimeout(r, 500));
    await upload('e2e-subscription-0009');
    await firstEvent;
    await client.dispose();

    expect(events[0]).toMatchObject({ type: 'INSERT', status: 'uploaded' });
  });

  it('starts returning 429 once the rate limit is exhausted', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 8; i++) {
      codes.push((await request(app.getHttpServer()).get('/api/health')).status);
    }
    expect(codes).toContain(429);
  });
});
