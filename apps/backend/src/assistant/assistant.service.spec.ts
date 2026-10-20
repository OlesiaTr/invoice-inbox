import { ConflictException } from '@nestjs/common';
import { Invoice } from '@prisma/client';
import { InvoicesService } from '../invoices/invoices.service';
import { ChatMessage, ChatResult, LlmClient } from '../llm/llm-client';
import { AssistantService, userStatedValue } from './assistant.service';

/** LLM double that replays a script of responses and records what it was sent. */
class ScriptedLlm extends LlmClient {
  readonly calls: ChatMessage[][] = [];
  constructor(private readonly script: ChatResult[]) {
    super();
  }
  async extractInvoice(): Promise<unknown> {
    throw new Error('not used');
  }
  async chat(messages: ChatMessage[]): Promise<ChatResult> {
    this.calls.push([...messages]);
    return this.script.shift() ?? { content: 'final answer', toolCalls: [] };
  }
}

const invoice = {
  id: '6f1c2f8e-0000-4000-8000-000000000001',
  originalName: 'acme.pdf',
  status: 'completed',
  invoiceNumber: 'INV-1',
  vendorName: 'Acme',
  issueDate: null,
  total: null,
  currency: 'EUR',
  warnings: [],
  errorReason: null,
  attempts: 1,
  extractedData: { total: 1000 },
  createdAt: new Date('2026-10-01T00:00:00Z'),
} as unknown as Invoice;

function setup(script: ChatResult[]) {
  const invoices = {
    findByRef: jest.fn().mockResolvedValue(invoice),
    delete: jest.fn().mockResolvedValue(invoice),
    updateFields: jest.fn().mockResolvedValue(invoice),
    retry: jest.fn().mockResolvedValue(invoice),
    list: jest.fn().mockResolvedValue({ items: [invoice], total: 1 }),
  };
  const llm = new ScriptedLlm(script);
  const service = new AssistantService(llm, invoices as unknown as InvoicesService);
  return { service, invoices, llm };
}

const user = (content: string) => [{ role: 'user' as const, content }];

describe('AssistantService', () => {
  it('runs read tools and feeds the result back to the model', async () => {
    const { service, invoices, llm } = setup([
      { content: '', toolCalls: [{ name: 'list_invoices', arguments: { status: 'failed' } }] },
      { content: 'No failed invoices.', toolCalls: [] },
    ]);
    const res = await service.chat(user('any failures?'));

    expect(invoices.list).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', limit: 10 }));
    expect(res.reply).toBe('No failed invoices.');
    expect(res.actions).toEqual([expect.objectContaining({ tool: 'list_invoices', ok: true })]);
    const toolMessage = llm.calls[1].at(-1)!;
    expect(toolMessage).toMatchObject({ role: 'tool', toolName: 'list_invoices' });
  });

  it('never executes destructive tools — it returns a pending action instead', async () => {
    const { service, invoices } = setup([
      { content: '', toolCalls: [{ name: 'delete_invoice', arguments: { ref: 'INV-1' } }] },
      { content: 'Please confirm the deletion.', toolCalls: [] },
    ]);
    const res = await service.chat(user('delete INV-1'));

    expect(invoices.delete).not.toHaveBeenCalled();
    expect(res.pendingActions).toEqual([
      expect.objectContaining({ kind: 'delete_invoice', invoiceId: invoice.id, summary: 'Delete invoice INV-1 (Acme)' }),
    ]);
  });

  it('normalises the value of a proposed field edit for the confirmation card', async () => {
    const { service, invoices } = setup([
      { content: '', toolCalls: [{ name: 'update_invoice_field', arguments: { ref: 'INV-1', field: 'total', value: '€1,200.00' } }] },
    ]);
    const res = await service.chat(user('the total should be €1,200.00'));

    expect(invoices.updateFields).not.toHaveBeenCalled();
    expect(res.pendingActions[0]).toMatchObject({
      kind: 'update_invoice_field',
      field: 'total',
      value: 1200,
      summary: 'Change total of INV-1 (Acme) from 1000 to 1200',
    });
  });

  it('refuses an edit whose value the user never stated', async () => {
    const { service, llm } = setup([
      { content: '', toolCalls: [{ name: 'update_invoice_field', arguments: { ref: 'INV-1', field: 'total', value: 150.5 } }] },
    ]);
    const res = await service.chat(user("let's correct the sum of INV-1"));

    expect(res.pendingActions).toEqual([]);
    expect(llm.calls[1].at(-1)!.content).toMatch(/user did not mention value 150.5/);
  });

  it('rejects a filter the user did not ask for', async () => {
    const { service, llm } = setup([
      { content: '', toolCalls: [{ name: 'get_stats', arguments: { groupBy: 'vendor', currency: 'EUR' } }] },
    ]);
    await service.chat(user('How much did we spend per vendor?'));
    expect(llm.calls[1].at(-1)!.content).toMatch(/did not mention currency "EUR".*call the tool again without it/);
  });

  it('does not let the assistant clear a field', async () => {
    const { service, llm } = setup([
      { content: '', toolCalls: [{ name: 'update_invoice_field', arguments: { ref: 'INV-1', field: 'total', value: null } }] },
    ]);
    const res = await service.chat(user('fix the total'));

    expect(res.pendingActions).toEqual([]);
    expect(llm.calls[1].at(-1)!.content).toMatch(/^Error: invalid arguments for update_invoice_field/);
  });

  it('refuses a no-op edit instead of asking the user to confirm nothing', async () => {
    const { service, llm } = setup([
      { content: '', toolCalls: [{ name: 'update_invoice_field', arguments: { ref: 'INV-1', field: 'total', value: 1000 } }] },
    ]);
    const res = await service.chat(user('the total is 1000'));

    expect(res.pendingActions).toEqual([]);
    expect(llm.calls[1].at(-1)!.content).toMatch(/already 1000 — nothing to change/);
  });

  it('returns validation and business-rule errors to the model instead of throwing', async () => {
    const { service, invoices, llm } = setup([
      { content: '', toolCalls: [{ name: 'list_invoices', arguments: { status: 'bogus' } }] },
      { content: '', toolCalls: [{ name: 'retry_invoice', arguments: { ref: 'INV-1' } }] },
      { content: 'Explained.', toolCalls: [] },
    ]);
    invoices.retry.mockRejectedValue(new ConflictException('Only failed invoices can be retried'));
    const res = await service.chat(user('retry INV-1'));

    expect(llm.calls[1].at(-1)!.content).toMatch(/^Error: invalid arguments for list_invoices/);
    expect(llm.calls[2].at(-1)!.content).toBe('Error: Only failed invoices can be retried');
    expect(res.actions.at(-1)).toMatchObject({ tool: 'retry_invoice', ok: false });
    expect(res.reply).toBe('Explained.');
  });

  it('asks the model to check itself once when it answered without any tool', async () => {
    const { service, invoices, llm } = setup([
      { content: 'INV-777 is from Test Vendor LLC. Please confirm the deletion.', toolCalls: [] }, // invented
      { content: '', toolCalls: [{ name: 'delete_invoice', arguments: { ref: 'INV-1' } }] },
      { content: 'Please confirm the deletion below.', toolCalls: [] },
    ]);
    const res = await service.chat(user('Delete invoice INV-1'));

    expect(llm.calls[1].at(-1)!.content).toMatch(/^\[Automatic check/);
    expect(res.pendingActions).toHaveLength(1);
    expect(res.reply).toBe('Please confirm the deletion below.');
    expect(invoices.delete).not.toHaveBeenCalled();
  });

  it('keeps the original answer when the check finds no tool was needed', async () => {
    const { service, llm } = setup([
      { content: 'Hi! How can I help?', toolCalls: [] },
      { content: 'OK', toolCalls: [] },
    ]);
    const res = await service.chat(user('hello'));
    expect(llm.calls).toHaveLength(2);
    expect(res.reply).toBe('Hi! How can I help?');
  });

  it('stops a model that keeps calling tools', async () => {
    const loop = { content: '', toolCalls: [{ name: 'list_invoices', arguments: {} }] };
    const { service, llm } = setup(Array.from({ length: 20 }, () => loop));
    const res = await service.chat(user('loop forever'));

    expect(llm.calls).toHaveLength(5);
    expect(res.reply).toMatch(/couldn't finish/);
  });

  it('rejects unknown tools', async () => {
    const { service, llm } = setup([{ content: '', toolCalls: [{ name: 'drop_database', arguments: {} }] }]);
    await service.chat(user('hack'));
    expect(llm.calls[1].at(-1)!.content).toBe('Error: unknown tool "drop_database"');
  });
});

describe('userStatedValue', () => {
  it.each([
    ['set the total to 1200', 1200],
    ['total should be €1,200.00', 1200],
    ['tax is 19,50', 19.5],
    ['vendor is Acme GmbH', 'acme gmbh'],
    ['due date 01.10.2026', '2026-10-01'],
    ['issued Sep 3, 2026', '2026-09-03'],
  ] as const)('accepts "%s" for %s', (text, value) => {
    expect(userStatedValue(text, value)).toBe(true);
  });

  it.each([
    ["let's correct the sum of FL-1", 150.5],
    ['FL-1 total is wrong', 1],
    ['change the vendor', 'Acme'],
    ['set the total to 12', 120],
  ] as const)('rejects "%s" for %s', (text, value) => {
    expect(userStatedValue(text, value)).toBe(false);
  });
});
