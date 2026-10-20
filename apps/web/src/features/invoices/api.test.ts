import { QueryClient } from '@tanstack/react-query';
import { invoiceKeys, patchInvoiceInLists, type InvoicesPage } from './api';

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
