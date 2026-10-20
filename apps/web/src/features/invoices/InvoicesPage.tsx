import { useNavigate } from '@tanstack/react-router';
import { RotateCcw, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { InvoiceStatus } from '@/gql/graphql';
import { cn } from '@/lib/utils';
import { invoicesRoute, type InvoicesSearch } from '@/router';
import { useInvoices, useRetryAllFailed, useStatusCounts } from './api';
import { InvoiceDetailSheet } from './InvoiceDetailSheet';
import { InvoiceTable } from './InvoiceTable';
import { STATUS_LABELS } from './StatusBadge';
import { UploadDropzone } from './UploadDropzone';

const PAGE_SIZE = 20;

const TABS: { status?: InvoiceStatus; label: string; tone: string }[] = [
  { label: 'All', tone: 'bg-lightprimary text-primary' },
  { status: 'uploaded', label: STATUS_LABELS.uploaded, tone: 'bg-lightinfo text-info' },
  { status: 'processing', label: STATUS_LABELS.processing, tone: 'bg-lightwarning text-warning' },
  { status: 'completed', label: STATUS_LABELS.completed, tone: 'bg-lightsuccess text-success' },
  { status: 'failed', label: STATUS_LABELS.failed, tone: 'bg-lighterror text-error' },
];

export function InvoicesPage() {
  const search = invoicesRoute.useSearch();
  const navigate = useNavigate({ from: invoicesRoute.fullPath });
  const setSearch = (patch: Partial<InvoicesSearch>) =>
    navigate({ search: (s) => ({ ...s, ...patch }), replace: true });

  const page = search.page ?? 1;
  const { data, isLoading, isFetching, error } = useInvoices({
    status: search.status,
    search: search.q,
    sortBy: search.sort,
    sortDir: search.dir,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const counts = useStatusCounts().data;
  const retryAll = useRetryAllFailed();

  // Debounce typing into the URL (and therefore into the query key).
  const [q, setQ] = useState(search.q ?? '');
  useEffect(() => {
    const t = setTimeout(() => {
      if ((search.q ?? '') !== q) setSearch({ q: q || undefined, page: undefined });
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-dark dark:text-white">Invoices</h1>
        <p className="text-sm text-muted-foreground">
          Upload invoices; they're processed in the background and update here live.
        </p>
      </div>

      <UploadDropzone />

      <Card className="p-0">
        <div className="flex flex-col gap-4 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Filter by status">
            {TABS.map((tab) => {
              const active = search.status === tab.status;
              const count = counts ? (tab.status ? counts[tab.status] : counts.all) : undefined;
              return (
                <button
                  key={tab.label}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSearch({ status: tab.status, page: undefined })}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-lightprimary',
                    active && 'bg-lightprimary text-primary',
                  )}
                >
                  {tab.label}
                  <span className={cn('min-w-7 rounded-full px-2 py-0.5 text-xs', tab.tone)}>{count ?? '·'}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            {!!counts?.failed && (
              <Button
                variant="lighterror"
                size="sm"
                disabled={retryAll.isPending}
                onClick={() =>
                  retryAll.mutate(undefined, {
                    onSuccess: (n) => toast.success(`Retrying ${n} failed invoice${n === 1 ? '' : 's'}`),
                    onError: (e) => toast.error(e.message),
                  })
                }
              >
                <RotateCcw /> Retry all failed
              </Button>
            )}
            <div className="relative w-full lg:w-72">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search file, vendor, number…"
                className="pl-9"
                aria-label="Search invoices"
              />
            </div>
          </div>
        </div>

        <InvoiceTable
          rows={data?.items ?? []}
          loading={isLoading}
          error={error}
          refreshing={isFetching && !isLoading}
          sort={{ by: search.sort ?? 'createdAt', dir: search.dir ?? 'desc' }}
          onSortChange={(by, dir) => setSearch({ sort: by, dir, page: undefined })}
          onOpen={(id) => setSearch({ invoice: id })}
        />

        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
          <span>{data ? `${data.total} invoice${data.total === 1 ? '' : 's'}` : ' '}</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setSearch({ page: page - 1 })}>
              Previous
            </Button>
            <span>
              Page {page} of {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setSearch({ page: page + 1 })}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      <InvoiceDetailSheet id={search.invoice} onClose={() => setSearch({ invoice: undefined })} />
    </div>
  );
}
