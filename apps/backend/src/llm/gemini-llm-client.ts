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

  private readonly models: string[];

  /**
   * @param model primary model; `fallbackModels` are tried in order when it is overloaded
   *   (the free tier regularly answers 503 "high demand" or 429 "rate limited").
   */
  constructor(
    apiKey: string,
    model: string,
    private readonly timeoutMs: number,
    { baseUrl, fallbackModels = [], retryDelayMs = 1500 }: { baseUrl?: string; fallbackModels?: string[]; retryDelayMs?: number } = {},
  ) {
    super();
    this.models = [model, ...fallbackModels.filter((m) => m && m !== model)];
    this.retryDelayMs = retryDelayMs;
    this.ai = new GoogleGenAI({ apiKey, httpOptions: baseUrl ? { baseUrl } : undefined });
  }

  private readonly retryDelayMs: number;

  async extractInvoice(invoiceText: string): Promise<unknown> {
    const res = await this.call((model) =>
      this.ai.models.generateContent({
        model,
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
    const res = await this.call((model) =>
      this.ai.models.generateContent({
        model,
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
          temperature: 0,
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

  /**
   * Overloaded (503) or rate-limited (429): retry the same model once after a short pause,
   * then move on to the next fallback model. Anything else fails right away.
   */
  private async call(fn: (model: string) => Promise<GenerateContentResponse>): Promise<GenerateContentResponse> {
    let lastError: unknown;
    for (const model of this.models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          return await withTimeout(fn(model), this.timeoutMs, 'Gemini request');
        } catch (err) {
          lastError = err;
          if (!isOverloaded(err)) throw new TransientProcessingError(`Gemini (${model}) failed: ${errorMessage(err)}`);
          if (attempt === 0) await new Promise((r) => setTimeout(r, this.retryDelayMs));
        }
      }
    }
    // Still transient: the queue retries extraction later with backoff.
    throw new TransientProcessingError(
      `Gemini is overloaded (tried ${this.models.join(', ')}): ${errorMessage(lastError)}`,
    );
  }

}

function isOverloaded(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  return status === 503 || status === 429 || /UNAVAILABLE|RESOURCE_EXHAUSTED|high demand/i.test(errorMessage(err));
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
