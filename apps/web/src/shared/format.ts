export const formatMoney = (amount: number | null | undefined, currency: string | null | undefined): string => {
  if (amount == null) return '—';
  if (!currency) return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  try {
    return amount.toLocaleString(undefined, { style: 'currency', currency });
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
};

export const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

export const timeAgo = (iso: string): string => {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return 'just now';
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour');
  return rtf.format(Math.round(seconds / 86400), 'day');
};
