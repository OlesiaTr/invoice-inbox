import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { TransientProcessingError } from '../invoices/domain/processing-errors';
import { GeminiLlmClient } from './gemini-llm-client';

/** Contract test against a stub of the Gemini REST API (generateContent). */
describe('GeminiLlmClient', () => {
  let server: Server;
  let baseUrl: string;
  let lastBody: Record<string, any>;
  let status = 200;
  let reply: unknown;

  beforeAll(async () => {
    server = createServer(async (req, res) => {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      lastBody = JSON.parse(raw);
      res.statusCode = status;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(reply));
    });
    await new Promise<void>((r) => server.listen(0, r));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise((r) => server.close(r)));
  beforeEach(() => (status = 200));

  const candidate = (parts: unknown[]) => ({ candidates: [{ content: { role: 'model', parts } }] });

  it('requests JSON output constrained by the invoice schema', async () => {
    reply = candidate([{ text: '{"invoiceNumber":"INV-1"}' }]);
    const client = new GeminiLlmClient('key', 'gemini-flash-latest', 5000, baseUrl);

    await expect(client.extractInvoice('Invoice INV-1')).resolves.toEqual({ invoiceNumber: 'INV-1' });
    expect(lastBody.generationConfig).toMatchObject({ responseMimeType: 'application/json', temperature: 0 });
    expect(lastBody.generationConfig.responseJsonSchema).toMatchObject({ type: 'object' });
    expect(lastBody.systemInstruction.parts[0].text).toContain('extract structured data');
  });

  it('maps tool calls and tool results to function calls and responses', async () => {
    reply = candidate([{ functionCall: { name: 'list_invoices', args: { status: 'failed' } } }]);
    const client = new GeminiLlmClient('key', 'm', 5000, baseUrl);

    const res = await client.chat(
      [
        { role: 'system', content: 'be nice' },
        { role: 'user', content: 'failed?' },
        { role: 'assistant', content: '', toolCalls: [{ name: 'get_stats', arguments: {} }, { name: 'list_invoices', arguments: {} }] },
        { role: 'tool', toolName: 'get_stats', content: '{"a":1}' },
        { role: 'tool', toolName: 'list_invoices', content: '{"b":2}' },
      ],
      [{ name: 'list_invoices', description: 'List', parameters: { type: 'object' } }],
    );

    expect(res.toolCalls).toEqual([{ name: 'list_invoices', arguments: { status: 'failed' } }]);
    expect(lastBody.tools[0].functionDeclarations[0]).toMatchObject({ name: 'list_invoices', parametersJsonSchema: { type: 'object' } });
    expect(lastBody.contents.map((c: { role: string }) => c.role)).toEqual(['user', 'model', 'user']);
    expect(lastBody.contents[2].parts).toHaveLength(2); // both results answer the same model turn
  });

  it('treats rate limiting as transient', async () => {
    status = 429;
    reply = { error: { code: 429, message: 'Resource exhausted', status: 'RESOURCE_EXHAUSTED' } };
    const client = new GeminiLlmClient('key', 'm', 5000, baseUrl);
    await expect(client.extractInvoice('x')).rejects.toBeInstanceOf(TransientProcessingError);
  });
});
