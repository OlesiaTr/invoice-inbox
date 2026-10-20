import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  FileImage,
  FileText,
  MoreVertical,
  RotateCcw,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { InvoiceSortField, SortDirection } from '@/gql/graphql';
import { CopyButton } from '@/shared/CopyButton';
import { formatDate, formatMoney, timeAgo } from '@/shared/format';
import { useNow } from '@/shared/use-media-query';
import { type InvoiceRow } from './api';
import { StatusBadge } from './StatusBadge';

const col = createColumnHelper<InvoiceRow>();

interface Props {
  rows: InvoiceRow[];
  loading: boolean;
  refreshing: boolean;
  error: Error | null;
  sort: { by: InvoiceSortField; dir: SortDirection };
  onSortChange: (by: InvoiceSortField, dir: SortDirection) => void;
  onOpen: (id: string) => void;
  onRetry: (id: string) => void;
  onRequestDelete: (id: string, name: string) => void;
}

/**
 * Pure presentation: sorting is server-side (manualSorting) and every action is reported
 * to the parent, which owns the mutations. That also keeps the column memo below stable.
 */
export const InvoiceTable = ({
  rows,
  loading,
  refreshing,
  error,
  sort,
  onSortChange,
  onOpen,
  onRetry,
  onRequestDelete,
}: Props) => {
  // Re-render on a timer so the "Uploaded" column's relative times don't freeze.
  useNow();

  const columns = useMemo(
    () => [
      col.accessor('originalName', {
        header: 'File',
        enableSorting: false,
        cell: ({ row }) => {
          const Icon = row.original.mimeType === 'application/pdf' ? FileText : FileImage;
          return (
            <div className="flex min-w-0 items-center gap-2.5">
              <Icon className="size-4 shrink-0 text-primary" />
              <span className="truncate font-medium text-dark dark:text-white" title={row.original.originalName}>
                {row.original.originalName}
              </span>
            </div>
          );
        },
      }),
      col.accessor('vendorName', {
        id: 'vendorName',
        header: 'Vendor',
        cell: (c) => c.getValue() ?? <span className="text-muted-foreground">—</span>,
      }),
      col.accessor('invoiceNumber', {
        header: 'Number',
        enableSorting: false,
        cell: (c) => {
          const n = c.getValue();
          if (!n) return '—';
          return (
            <span className="inline-flex items-center gap-1">
              {n}
              {/* Shown on row hover (always visible on touch screens) */}
              <CopyButton
                value={n}
                label="Copy invoice number"
                className="opacity-100 sm:opacity-0 sm:group-hover/row:opacity-100 focus-visible:opacity-100"
              />
            </span>
          );
        },
      }),
      col.accessor('issueDate', { id: 'issueDate', header: 'Issued', cell: (c) => formatDate(c.getValue()) }),
      col.accessor('total', {
        id: 'total',
        header: 'Total',
        cell: ({ row }) => (
          <span className="tabular-nums">{formatMoney(row.original.total, row.original.currency)}</span>
        ),
      }),
      col.accessor('status', {
        header: 'Status',
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex items-center gap-1.5">
              <StatusBadge status={r.status} />
              {r.warnings.length > 0 && r.status === 'completed' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <TriangleAlert className="size-4 text-warning" aria-label="Has warnings" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">{r.warnings.join(' · ')}</TooltipContent>
                </Tooltip>
              )}
              {r.status === 'uploaded' && r.errorReason && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs text-warning">retry {r.attempts + 1}</span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">{r.errorReason}</TooltipContent>
                </Tooltip>
              )}
            </div>
          );
        },
      }),
      col.accessor('createdAt', {
        id: 'createdAt',
        header: 'Uploaded',
        cell: (c) => <span className="whitespace-nowrap text-muted-foreground">{timeAgo(c.getValue())}</span>,
      }),
      col.display({
        id: 'actions',
        cell: ({ row }) => {
          const r = row.original;
          return (
            // Not a control: the handler exists only so clicking a button in here doesn't
            // also open the row. Keyboard users reach the buttons directly.
            // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
            <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
              {r.status === 'failed' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghostprimary"
                      size="icon"
                      className="size-8"
                      aria-label="Retry"
                      onClick={() => onRetry(r.id)}
                    >
                      <RotateCcw />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Retry processing</TooltipContent>
                </Tooltip>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-8" aria-label="More actions">
                    <MoreVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onOpen(r.id)}>Open details</DropdownMenuItem>
                  <DropdownMenuItem className="text-error" onClick={() => onRequestDelete(r.id, r.originalName)}>
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      }),
    ],
    [onOpen, onRetry, onRequestDelete],
  );

  const sorting: SortingState = [{ id: sort.by, desc: sort.dir === 'desc' }];
  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (r) => r.id,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      const s = next[0];
      if (s) onSortChange(s.id as InvoiceSortField, s.desc ? 'desc' : 'asc');
      else onSortChange('createdAt', 'desc');
    },
  });

  return (
    <div className={refreshing ? 'opacity-80 transition-opacity' : undefined}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id} className="hover:bg-transparent">
              {hg.headers.map((h) => {
                const sorted = h.column.getIsSorted();
                return (
                  <TableHead key={h.id} className="whitespace-nowrap">
                    {h.column.getCanSort() ? (
                      <button
                        className="inline-flex items-center gap-1 hover:text-primary"
                        onClick={h.column.getToggleSortingHandler()}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {sorted === 'asc' ? (
                          <ArrowUp className="size-3.5" />
                        ) : sorted === 'desc' ? (
                          <ArrowDown className="size-3.5" />
                        ) : (
                          <ArrowUpDown className="size-3.5 opacity-40" />
                        )}
                      </button>
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading &&
            Array.from({ length: 5 }, (_, i) => (
              <TableRow key={i}>
                {columns.map((_c, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          {!loading && error && (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-10 text-center text-error">
                {error.message}
              </TableCell>
            </TableRow>
          )}
          {!loading && !error && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-10 text-center text-muted-foreground">
                No invoices here yet.
              </TableCell>
            </TableRow>
          )}
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              className="group/row cursor-pointer"
              // A row is interactive, so it has to be reachable and operable by keyboard.
              role="button"
              tabIndex={0}
              aria-label={`Open ${row.original.originalName}`}
              onClick={() => {
                // Selecting text (e.g. to copy a vendor name) must not open the details.
                if (window.getSelection()?.toString()) return;
                onOpen(row.id);
              }}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                onOpen(row.id);
              }}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className="max-w-64 whitespace-nowrap">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
