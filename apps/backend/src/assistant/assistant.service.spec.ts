import { ConflictException } from '@nestjs/common';
import { Invoice } from '@prisma/client';
import { InvoicesService } from '../invoices/invoices.service';
import { ChatMessage, ChatResult, LlmClient } from '../llm/llm-client';
import { AssistantService } from './assistant.service';

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
  extractedData: null,
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
    const res = await service.chat(user('total should be 1200'));

    expect(invoices.updateFields).not.toHaveBeenCalled();
    expect(res.pendingActions[0]).toMatchObject({ kind: 'update_invoice_field', field: 'total', value: 1200 });
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
