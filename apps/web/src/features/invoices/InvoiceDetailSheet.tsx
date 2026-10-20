import { CircleAlert, ExternalLink, Pencil, RotateCcw, TriangleAlert } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { UpdateInvoiceFieldsInput } from '@/gql/graphql';
import { formatDate, formatMoney } from '@/shared/format';
import { invoiceFileUrl, useInvoice, useRetryInvoice, useUpdateInvoiceFields, type InvoiceDetail } from './api';
import { StatusBadge } from './StatusBadge';

export function InvoiceDetailSheet({ id, onClose }: { id?: string; onClose: () => void }) {
  const { data: invoice, isLoading, error } = useInvoice(id);
  const retry = useRetryInvoice();

  return (
    <Sheet open={!!id} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-2xl">
        <SheetHeader className="border-b border-border p-6 pr-12">
          <SheetTitle className="truncate text-lg">
            {invoice ? (invoice.invoiceNumber ?? invoice.originalName) : 'Invoice'}
          </SheetTitle>
          <SheetDescription asChild>
            <div className="flex flex-wrap items-center gap-2">
              {invoice && (
                <>
                  <StatusBadge status={invoice.status} />
                  <span className="truncate">{invoice.originalName}</span>
                  <span>· {(invoice.sizeBytes / 1024).toFixed(0)} KB</span>
                  <span>· {invoice.attempts} attempt{invoice.attempts === 1 ? '' : 's'}</span>
                </>
              )}
            </div>
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 p-6">
          {isLoading && <Skeleton className="h-40 w-full" />}
          {error && <p className="text-error">{error.message}</p>}
          {invoice && (
            <>
              {invoice.status === 'failed' && (
                <Alert variant="lighterror">
                  <CircleAlert className="size-4" />
                  <AlertTitle>Processing failed</AlertTitle>
                  <AlertDescription className="space-y-3">
                    <p>{invoice.errorReason}</p>
                    <Button
                      size="sm"
                      variant="error"
                      disabled={retry.isPending}
                      onClick={() => retry.mutate(invoice.id, { onError: (e) => toast.error(e.message) })}
                    >
                      <RotateCcw /> Retry
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              {(invoice.status === 'uploaded' || invoice.status === 'processing') && (
                <Alert variant="lightinfo">
                  <AlertDescription>
                    {invoice.errorReason ?? 'Waiting for the worker — this panel updates by itself.'}
                  </AlertDescription>
                </Alert>
              )}
              {invoice.status === 'completed' && invoice.warnings.length > 0 && (
                <Alert variant="lightwarning">
                  <TriangleAlert className="size-4" />
                  <AlertTitle>Please double-check</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-4">
                      {invoice.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {invoice.extractedData && <ExtractedFields invoice={invoice} />}
              <FilePreview invoice={invoice} />

              {invoice.rawText && (
                <details className="rounded-lg border border-border">
                  <summary className="cursor-pointer px-4 py-2 text-sm font-medium">
                    Text the AI read (PDF text / OCR)
                  </summary>
                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap border-t border-border p-4 text-xs">
                    {invoice.rawText}
                  </pre>
                </details>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

type FieldKey = keyof UpdateInvoiceFieldsInput;
const FIELDS: { key: FieldKey; label: string; type: 'text' | 'date' | 'number' }[] = [
  { key: 'vendorName', label: 'Vendor', type: 'text' },
  { key: 'invoiceNumber', label: 'Invoice number', type: 'text' },
  { key: 'customerName', label: 'Customer', type: 'text' },
  { key: 'vendorAddress', label: 'Vendor address', type: 'text' },
  { key: 'issueDate', label: 'Issue date', type: 'date' },
  { key: 'dueDate', label: 'Due date', type: 'date' },
  { key: 'currency', label: 'Currency', type: 'text' },
  { key: 'subtotal', label: 'Subtotal', type: 'number' },
  { key: 'tax', label: 'Tax', type: 'number' },
  { key: 'total', label: 'Total', type: 'number' },
];

function ExtractedFields({ invoice }: { invoice: InvoiceDetail }) {
  const data = invoice.extractedData!;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const update = useUpdateInvoiceFields();

  useEffect(() => {
    setEditing(false);
  }, [invoice.id]);

  const startEditing = () => {
    setDraft(Object.fromEntries(FIELDS.map((f) => [f.key, data[f.key]?.toString() ?? ''])));
    setEditing(true);
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    // Send only what changed; empty means "clear the field".
    const input: UpdateInvoiceFieldsInput = {};
    for (const f of FIELDS) {
      const before = data[f.key]?.toString() ?? '';
      const after = draft[f.key]?.trim() ?? '';
      if (before === after) continue;
      (input as Record<string, unknown>)[f.key] = after === '' ? null : f.type === 'number' ? Number(after) : after;
    }
    if (Object.keys(input).length === 0) return setEditing(false);
    update.mutate(
      { id: invoice.id, input },
      {
        onSuccess: () => {
          toast.success('Invoice updated');
          setEditing(false);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  const display = (f: (typeof FIELDS)[number]) => {
    const v = data[f.key];
    if (v == null || v === '') return <span className="text-muted-foreground">—</span>;
    if (f.type === 'date') return formatDate(v as string);
    if (f.type === 'number') return formatMoney(v as number, data.currency);
    return v;
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-dark dark:text-white">Extracted data</h3>
        {!editing && invoice.status === 'completed' && (
          <Button variant="ghostprimary" size="sm" onClick={startEditing}>
            <Pencil /> Edit
          </Button>
        )}
      </div>

      {editing ? (
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <Label htmlFor={f.key}>{f.label}</Label>
                <Input
                  id={f.key}
                  type={f.type}
                  step={f.type === 'number' ? '0.01' : undefined}
                  value={draft[f.key] ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={update.isPending}>
              Save
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{f.label}</dt>
              <dd className="truncate text-sm font-medium text-dark dark:text-white">{display(f)}</dd>
            </div>
          ))}
        </dl>
      )}

      {data.lineItems.length > 0 && (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit price</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.lineItems.map((li, i) => (
                <TableRow key={i}>
                  <TableCell>{li.description}</TableCell>
                  <TableCell className="text-right tabular-nums">{li.quantity ?? '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(li.unitPrice, data.currency)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(li.amount, data.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

function FilePreview({ invoice }: { invoice: InvoiceDetail }) {
  const url = invoiceFileUrl(invoice.id);
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-dark dark:text-white">Original file</h3>
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary">
          Open <ExternalLink className="size-3.5" />
        </a>
      </div>
      {invoice.mimeType === 'application/pdf' ? (
        <iframe src={url} title={invoice.originalName} className="h-[480px] w-full rounded-lg border border-border" />
      ) : (
        <img src={url} alt={invoice.originalName} className="w-full rounded-lg border border-border" />
      )}
    </section>
  );
}
