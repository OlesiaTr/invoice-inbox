import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { TransientProcessingError } from '../invoices/domain/processing-errors';
import { OllamaLlmClient } from './ollama-llm-client';

/**
 * Contract test against a stub of Ollama's /api/chat: checks the request we send
 * (structured-output schema, tools) and how we read responses — no model needed.
 */
describe('OllamaLlmClient', () => {
  let server: Server;
  let url: string;
  let lastBody: Record<string, any>;
  let reply: (body: Record<string, any>) => unknown;

  beforeAll(async () => {
    server = createServer(async (req: IncomingMessage, res) => {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      lastBody = JSON.parse(raw);
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(reply(lastBody)));
    });
    await new Promise<void>((r) => server.listen(0, r));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise((r) => server.close(r)));

  const message = (m: Record<string, unknown>) => ({ model: 'm', created_at: '', message: m, done: true });

  it('asks for structured output and parses the JSON answer', async () => {
    reply = () => message({ role: 'assistant', content: '{"invoiceNumber":"INV-1","total":10}' });
    const client = new OllamaLlmClient(url, 'qwen2.5:7b', 5000);

    await expect(client.extractInvoice('Invoice INV-1 total 10')).resolves.toEqual({
      invoiceNumber: 'INV-1',
      total: 10,
    });
    expect(lastBody.model).toBe('qwen2.5:7b');
    expect(lastBody.stream).toBe(false);
    expect(lastBody.format).toMatchObject({ type: 'object', required: expect.arrayContaining(['total']) });
    expect(lastBody.options.temperature).toBe(0);
    expect(lastBody.messages[1].content).toContain('<invoice_text>');
  });

  it('treats invalid JSON as a transient (retryable) error', async () => {
    reply = () => message({ role: 'assistant', content: 'Sure! Here is the data:' });
    const client = new OllamaLlmClient(url, 'm', 5000);
    await expect(client.extractInvoice('text')).rejects.toBeInstanceOf(TransientProcessingError);
  });

  it('sends tools and maps tool calls both ways', async () => {
    reply = () =>
      message({
        role: 'assistant',
        content: '',
        tool_calls: [{ function: { name: 'list_invoices', arguments: { status: 'failed' } } }],
      });
    const client = new OllamaLlmClient(url, 'm', 5000);
    const res = await client.chat(
      [
        { role: 'user', content: 'failed?' },
        { role: 'assistant', content: '', toolCalls: [{ name: 'get_stats', arguments: { groupBy: 'status' } }] },
        { role: 'tool', toolName: 'get_stats', content: '{"failed":1}' },
      ],
      [{ name: 'list_invoices', description: 'List', parameters: { type: 'object', properties: {} } }],
    );

    expect(res.toolCalls).toEqual([{ name: 'list_invoices', arguments: { status: 'failed' } }]);
    expect(lastBody.tools[0]).toEqual({
      type: 'function',
      function: { name: 'list_invoices', description: 'List', parameters: { type: 'object', properties: {} } },
    });
    expect(lastBody.messages[1].tool_calls[0].function).toEqual({
      name: 'get_stats',
      arguments: { groupBy: 'status' },
    });
    expect(lastBody.messages[2]).toMatchObject({ role: 'tool', tool_name: 'get_stats' });
  });

  it('turns an unreachable server into a transient error', async () => {
    const client = new OllamaLlmClient('http://127.0.0.1:1', 'm', 2000);
    await expect(client.extractInvoice('x')).rejects.toBeInstanceOf(TransientProcessingError);
  });
});
