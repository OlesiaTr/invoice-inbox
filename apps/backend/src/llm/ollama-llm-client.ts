import { Ollama, type Message } from 'ollama';
import { EXTRACTED_INVOICE_JSON_SCHEMA } from '../invoices/domain/invoice-data';
import { TransientProcessingError, errorMessage } from '../invoices/domain/processing-errors';
import { type ChatMessage, type ChatResult, LlmClient, type ToolSpec } from './llm-client';
import { EXTRACTION_SYSTEM_PROMPT, extractionUserPrompt } from './prompts';
import { withTimeout } from './with-timeout';

/** Local model via Ollama — free, offline, data never leaves the machine. */
export class OllamaLlmClient extends LlmClient {
  private readonly client: Ollama;

  constructor(
    host: string,
    private readonly model: string,
    private readonly timeoutMs: number,
  ) {
    super();
    this.client = new Ollama({ host });
  }

  async extractInvoice(invoiceText: string): Promise<unknown> {
    const res = await this.call(() =>
      this.client.chat({
        model: this.model,
        messages: [
          { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
          { role: 'user', content: extractionUserPrompt(invoiceText) },
        ],
        format: EXTRACTED_INVOICE_JSON_SCHEMA,
        options: { temperature: 0 },
        stream: false,
      }),
    );
    try {
      return JSON.parse(res.message.content);
    } catch {
      throw new TransientProcessingError('The model returned invalid JSON');
    }
  }

  async chat(messages: ChatMessage[], tools: ToolSpec[]): Promise<ChatResult> {
    const res = await this.call(() =>
      this.client.chat({
        model: this.model,
        messages: messages.map(toOllamaMessage),
        tools: tools.map((t) => ({
          type: 'function',
          function: { name: t.name, description: t.description, parameters: t.parameters as never },
        })),
        options: { temperature: 0 },
        stream: false,
      }),
    );
    return {
      content: res.message.content,
      toolCalls: (res.message.tool_calls ?? []).map((tc) => ({
        name: tc.function.name,
        arguments: tc.function.arguments ?? {},
      })),
    };
  }

  private async call<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await withTimeout(fn(), this.timeoutMs, 'Ollama request');
    } catch (err) {
      throw new TransientProcessingError(`Ollama (${this.model}) failed: ${errorMessage(err)}`);
    }
  }
}

function toOllamaMessage(m: ChatMessage): Message {
  switch (m.role) {
    case 'assistant':
      return {
        role: 'assistant',
        content: m.content,
        tool_calls: m.toolCalls?.map((tc) => ({ function: { name: tc.name, arguments: tc.arguments } })),
      };
    case 'tool':
      return { role: 'tool', content: m.content, tool_name: m.toolName };
    default:
      return { role: m.role, content: m.content };
  }
}
