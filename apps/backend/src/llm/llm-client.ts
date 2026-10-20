export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ToolCall[] }
  | { role: 'tool'; toolName: string; content: string };

export interface ToolSpec {
  name: string;
  description: string;
  /** JSON schema of the arguments object. */
  parameters: Record<string, unknown>;
}

export interface ChatResult {
  content: string;
  toolCalls: ToolCall[];
}

/**
 * Port for the language model. Adapters: Ollama (local, default), Gemini (hosted demo),
 * Mock (tests and running without any model).
 */
export abstract class LlmClient {
  /** Turns invoice text into JSON matching EXTRACTED_INVOICE_JSON_SCHEMA. Output is untrusted. */
  abstract extractInvoice(invoiceText: string): Promise<unknown>;

  abstract chat(messages: ChatMessage[], tools: ToolSpec[]): Promise<ChatResult>;
}
