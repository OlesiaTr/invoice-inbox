import { Check, Copy } from 'lucide-react';
import { useState, type MouseEvent } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/** Small copy-to-clipboard icon; doesn't trigger the click handler of the row it sits in. */
export function CopyButton({
  value,
  label = 'Copy',
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async (e: MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy to the clipboard');
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`${label} ${value}`}
      title={label}
      className={cn('rounded p-1 text-muted-foreground hover:bg-lightprimary hover:text-primary', className)}
    >
      {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
    </button>
  );
}
