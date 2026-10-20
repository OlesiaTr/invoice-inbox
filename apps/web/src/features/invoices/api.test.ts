import { QueryClient } from '@tanstack/react-query';
import { invoiceKeys, patchInvoiceInLists, uploadInvoice, type InvoicesPage } from './api';

const row = (id: string, status: 'uploaded' | 'processing') =>
  ({ id, status, originalName: `${id}.pdf` }) as InvoicesPage['items'][number];

describe('patchInvoiceInLists', () => {
  it('patches the row in every cached list, whatever its filter', () => {
    const qc = new QueryClient();
    qc.setQueryData(invoiceKeys.list({}), { total: 2, items: [row('a', 'uploaded'), row('b', 'uploaded')] });
    qc.setQueryData(invoiceKeys.list({ search: 'a' }), { total: 1, items: [row('a', 'uploaded')] });

    patchInvoiceInLists(qc, 'a', { status: 'processing' });

    expect(qc.getQueryData<InvoicesPage>(invoiceKeys.list({}))!.items.map((r) => r.status)).toEqual([
      'processing',
      'uploaded',
    ]);
    expect(qc.getQueryData<InvoicesPage>(invoiceKeys.list({ search: 'a' }))!.items[0].status).toBe('processing');
  });

  it('leaves lists without the row untouched', () => {
    const qc = new QueryClient();
    const page = { total: 1, items: [row('b', 'uploaded')] };
    qc.setQueryData(invoiceKeys.list({}), page);
    patchInvoiceInLists(qc, 'zzz', { status: 'processing' });
    expect(qc.getQueryData<InvoicesPage>(invoiceKeys.list({}))!.items).toEqual(page.items);
  });
});

describe('uploadInvoice', () => {
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  afterEach(() => vi.unstubAllGlobals());

  it('retries after a lost response with the same idempotency key', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch')) // e.g. API restarting
      .mockResolvedValueOnce(
        new Response('<html>502</html>', { status: 502, headers: { 'content-type': 'text/html' } }),
      )
      .mockResolvedValueOnce(json(201, { invoice: { id: '1', originalName: 'a.pdf' }, duplicateOf: null }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await uploadInvoice(new File(['%PDF-'], 'a.pdf'), { retryDelaysMs: [0, 0] });

    expect(res.invoice.id).toBe('1');
    const keys = fetchMock.mock.calls.map(
      ([, init]) => (init as RequestInit & { headers: Record<string, string> }).headers['Idempotency-Key'],
    );
    expect(keys).toHaveLength(3);
    expect(new Set(keys).size).toBe(1);
  });

  it('does not retry validation errors', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(json(400, { message: 'Only PDF, PNG, JPEG and WEBP files are supported' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(uploadInvoice(new File(['x'], 'a.txt'), { retryDelaysMs: [0, 0] })).rejects.toThrow('Only PDF');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
