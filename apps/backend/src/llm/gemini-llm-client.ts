import { GoogleGenAI, type Content, type GenerateContentResponse } from '@google/genai';
import { EXTRACTED_INVOICE_JSON_SCHEMA } from '../invoices/domain/invoice-data';
import { TransientProcessingError, errorMessage } from '../invoices/domain/processing-errors';
import { ChatMessage, ChatResult, LlmClient, ToolSpec } from './llm-client';
import { EXTRACTION_SYSTEM_PROMPT, extractionUserPrompt } from './prompts';
import { withTimeout } from './with-timeout';

/**
 * Google Gemini (free tier) — used only for the hosted demo, where a local 7B model
 * can't run for free. Same port, same prompts and schema as the Ollama adapter.
 */
export class GeminiLlmClient extends LlmClient {
  private readonly ai: GoogleGenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
    private readonly timeoutMs: number,
    baseUrl?: string,
  ) {
    super();
    this.ai = new GoogleGenAI({ apiKey, httpOptions: baseUrl ? { baseUrl } : undefined });
  }

  async extractInvoice(invoiceText: string): Promise<unknown> {
    const res = await this.call(() =>
      this.ai.models.generateContent({
        model: this.model,
        contents: [{ role: 'user', parts: [{ text: extractionUserPrompt(invoiceText) }] }],
        config: {
          systemInstruction: EXTRACTION_SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          responseJsonSchema: EXTRACTED_INVOICE_JSON_SCHEMA,
          temperature: 0,
        },
      }),
    );
    try {
      return JSON.parse(res.text ?? '');
    } catch {
      throw new TransientProcessingError('The model returned invalid JSON');
    }
  }

  async chat(messages: ChatMessage[], tools: ToolSpec[]): Promise<ChatResult> {
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    const res = await this.call(() =>
      this.ai.models.generateContent({
        model: this.model,
        contents: toGeminiContents(messages),
        config: {
          systemInstruction: system || undefined,
          tools: [
            {
              functionDeclarations: tools.map((t) => ({
                name: t.name,
                description: t.description,
                parametersJsonSchema: t.parameters,
              })),
            },
          ],
          temperature: 0.2,
        },
      }),
    );
    // Read text parts directly: `res.text` warns when the answer also has function calls.
    const parts = res.candidates?.[0]?.content?.parts ?? [];
    return {
      content: parts.map((p) => p.text ?? '').join(''),
      toolCalls: (res.functionCalls ?? []).map((fc) => ({
        name: fc.name ?? '',
        arguments: (fc.args ?? {}) as Record<string, unknown>,
      })),
    };
  }

  private async call(fn: () => Promise<GenerateContentResponse>): Promise<GenerateContentResponse> {
    try {
      return await withTimeout(fn(), this.timeoutMs, 'Gemini request');
    } catch (err) {
      // Includes free-tier rate limits (429): worth retrying later.
      throw new TransientProcessingError(`Gemini (${this.model}) failed: ${errorMessage(err)}`);
    }
  }
}

/** Gemini roles are user/model; tool calls and results are message parts. */
function toGeminiContents(messages: ChatMessage[]): Content[] {
  const contents: Content[] = [];
  for (const m of messages) {
    switch (m.role) {
      case 'system':
        break;
      case 'user':
        contents.push({ role: 'user', parts: [{ text: m.content }] });
        break;
      case 'assistant':
        contents.push({
          role: 'model',
          parts: [
            ...(m.content ? [{ text: m.content }] : []),
            ...(m.toolCalls ?? []).map((tc) => ({ functionCall: { name: tc.name, args: tc.arguments } })),
          ],
        });
        break;
      case 'tool': {
        const part = { functionResponse: { name: m.toolName, response: { result: m.content } } };
        // Consecutive tool results belong in one user turn, answering one model turn.
        const prev = contents[contents.length - 1];
        if (prev?.role === 'user' && prev.parts?.every((p) => p.functionResponse)) prev.parts.push(part);
        else contents.push({ role: 'user', parts: [part] });
        break;
      }
    }
  }
  return contents;
}
