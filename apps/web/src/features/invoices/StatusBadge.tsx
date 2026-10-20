import { CheckCircle2, CircleAlert, Clock, Loader2 } from 'lucide-react';
import type { InvoiceStatus } from '@/gql/graphql';
import { Badge } from '@/components/ui/badge';

const STYLES: Record<
  InvoiceStatus,
  { label: string; variant: 'lightInfo' | 'lightWarning' | 'lightSuccess' | 'lightError'; icon: typeof Clock }
> = {
  uploaded: { label: 'Queued', variant: 'lightInfo', icon: Clock },
  processing: { label: 'Processing', variant: 'lightWarning', icon: Loader2 },
  completed: { label: 'Completed', variant: 'lightSuccess', icon: CheckCircle2 },
  failed: { label: 'Failed', variant: 'lightError', icon: CircleAlert },
};

export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  uploaded: 'Queued',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
};

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  const { label, variant, icon: Icon } = STYLES[status];
  return (
    <Badge variant={variant} className="gap-1 whitespace-nowrap">
      <Icon className={`size-3.5 ${status === 'processing' ? 'animate-spin' : ''}`} />
      {label}
    </Badge>
  );
}
