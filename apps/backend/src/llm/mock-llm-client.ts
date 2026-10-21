import { TransientProcessingError } from '../invoices/domain/processing-errors';
import { type ChatMessage, type ChatResult, LlmClient, type ToolCall } from './llm-client';
import { TOOL_CHECK_PROMPT } from './prompts';

/**
 * Deterministic stand-in for a real model: regex extraction and keyword-routed tool calls.
 * Lets reviewers run the whole flow without Ollama, and keeps tests fast and stable.
 */
export class MockLlmClient extends LlmClient {
  async extractInvoice(text: string): Promise<unknown> {
    // Lets tests and demos exercise the automatic-retry path on purpose.
    if (text.includes('SIMULATE_TRANSIENT_FAILURE')) {
      throw new TransientProcessingError('Simulated model timeout');
    }
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const amountOn = (re: RegExp) => {
      const line = [...lines].reverse().find((l) => re.test(l));
      return line ? parseAmount(line.replace(re, '')) : null;
    };
    const after = (re: RegExp) => {
      const i = lines.findIndex((l) => re.test(l));
      if (i < 0) return null;
      const rest = lines[i].replace(re, '').replace(/^[\s:]+/, '');
      return rest || lines[i + 1] || null;
    };

    return {
      invoiceNumber: text.match(/invoice\s*(?:no\.?|number|#)\s*[:#]?\s*([A-Z0-9][\w\-/]*)/i)?.[1] ?? null,
      vendorName: after(/^(from|seller|vendor)\b:?/i) ?? lines.find((l) => !/invoice/i.test(l)) ?? null,
      vendorAddress: null,
      customerName: after(/^(bill(ed)?\s*to|customer)\b:?/i),
      issueDate: findDate(text, /(?:invoice\s*date|issue\s*date|date\s*of\s*issue|^date)\s*:?\s*/im),
      dueDate: findDate(text, /due\s*(?:date)?\s*:?\s*/i),
      currency: detectCurrency(text),
      subtotal: amountOn(/^.*sub\s*-?\s*total\s*:?/i),
      tax: amountOn(/^.*\b(?:tax|vat)\b[^\d€$£-]*/i),
      total: amountOn(/^(?!.*sub\s*-?\s*total).*\b(?:total|amount\s*due|balance\s*due)\b[^\d€$£-]*/i),
      lineItems: [],
    };
  }

  async chat(messages: ChatMessage[]): Promise<ChatResult> {
    const last = messages[messages.length - 1];
    if (last.role === 'tool') {
      const results = messages.slice(messages.findLastIndex((m) => m.role !== 'tool') + 1);
      return { content: results.map((r) => summarize(r.content)).join('\n\n'), toolCalls: [] };
    }
    // The self-check prompt: the mock's routing is deterministic, so nothing to correct.
    if (last.role === 'user' && last.content === TOOL_CHECK_PROMPT) {
      return { content: 'OK', toolCalls: [] };
    }
    const text = last.content;
    const call = routeIntent(text);
    if (call) return { content: '', toolCalls: [call] };
    return {
      content:
        "I'm running in mock mode (no AI model configured), so I understand simple commands only. " +
        'Try: "show failed invoices", "retry all failed", "stats by vendor", "invoice INV-1001", "delete invoice INV-1001".',
      toolCalls: [],
    };
  }
}

const routeIntent = (text: string): ToolCall | null => {
  const t = text.toLowerCase();
  const ref =
    text.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i)?.[0] ??
    text.match(/\b([A-Z]{2,}[-/]?\d[\w\-/]*)\b/)?.[1];
  if (/\bretry\b/.test(t) && (/\ball\b/.test(t) || (!ref && /failed/.test(t)))) {
    return { name: 'retry_failed_invoices', arguments: {} };
  }
  if (/\bretry\b/.test(t) && ref) return { name: 'retry_invoice', arguments: { ref } };
  if (/\b(delete|remove)\b/.test(t) && ref) return { name: 'delete_invoice', arguments: { ref } };
  if (/\bvendor|spen[dt]\b/.test(t)) return { name: 'get_stats', arguments: { groupBy: 'vendor' } };
  if (/\bmonth/.test(t)) return { name: 'get_stats', arguments: { groupBy: 'month' } };
  if (/how many|stats|count|summary|overview/.test(t)) return { name: 'get_stats', arguments: { groupBy: 'status' } };
  if (/warning/.test(t)) return { name: 'list_invoices', arguments: { withWarnings: true } };
  const status = t.match(/\b(uploaded|processing|completed|failed)\b/)?.[1];
  if (status) return { name: 'list_invoices', arguments: { status } };
  if (ref) return { name: 'get_invoice', arguments: { ref } };
  if (/\b(list|show|all)\b.*invoices?/.test(t)) return { name: 'list_invoices', arguments: {} };
  return null;
};

const summarize = (content: string): string => {
  if (content.startsWith('NOT EXECUTED')) return 'I prepared that action — please review and confirm it below.';
  if (content.startsWith('Error:')) return content.replace(/^Error:\s*/, 'Sorry, that failed: ');
  try {
    const data = JSON.parse(content) as unknown;
    if (data && typeof data === 'object' && 'items' in data && Array.isArray(data.items)) {
      if (data.items.length === 0) return 'No invoices match.';
      return data.items
        .map(
          (i: Record<string, string | number | null | undefined>) =>
            `- ${i.invoiceNumber ?? i.file} · ${i.status}${i.vendor ? ` · ${i.vendor}` : ''}${i.total != null ? ` · ${i.total} ${i.currency ?? ''}` : ''}`,
        )
        .join('\n');
    }
    if (data && typeof data === 'object') {
      return Object.entries(data)
        .map(([k, v]) => `- ${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
        .join('\n');
    }
    return String(data);
  } catch {
    return content;
  }
};

const parseAmount = (s: string): number | null => {
  // The amount is the last number on the line ("VAT 20%: 16.86 EUR" → 16.86).
  const all = s.match(/-?\d[\d.,]*/g);
  if (!all) return null;
  let num = all[all.length - 1].replace(/[.,]$/, '');
  const lastComma = num.lastIndexOf(',');
  const lastDot = num.lastIndexOf('.');
  if (lastComma > lastDot) {
    // "1.234,56" or "99,50": comma is the decimal separator
    num = num.replace(/\./g, '').replace(',', '.');
  } else {
    num = num.replace(/,/g, '');
  }
  const n = Number(num);
  return Number.isFinite(n) ? n : null;
};

const findDate = (text: string, label: RegExp): string | null => {
  const m = text.match(
    new RegExp(
      label.source +
        '(\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[/.]\\d{1,2}[/.]\\d{4}|[A-Za-z]{3,9}\\.? \\d{1,2},? \\d{4}|\\d{1,2} [A-Za-z]{3,9} \\d{4})',
      label.flags,
    ),
  );
  if (!m) return null;
  const raw = m[1];
  const dmy = raw.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  return raw;
};

const detectCurrency = (text: string): string | null => {
  const code = text.match(/\b(EUR|USD|GBP|UAH|PLN|CHF)\b/)?.[1];
  if (code) return code;
  if (/грн|₴/.test(text)) return 'UAH';
  if (text.includes('€')) return 'EUR';
  if (text.includes('£')) return 'GBP';
  if (text.includes('$')) return 'USD';
  return null;
};
