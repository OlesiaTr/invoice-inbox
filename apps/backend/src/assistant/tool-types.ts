import { z } from 'zod';
import { type InvoicesService } from '../invoices/invoices.service';

/**
 * The shape every assistant tool takes. Tools call the same application service as the
 * UI, so business rules — like "only failed invoices can be retried" — apply to the AI
 * too, and there is no raw SQL access.
 */
export interface AssistantTool<A = Record<string, unknown>> {
  name: string;
  description: string;
  schema: z.ZodType<A>;
  /**
   * Destructive tools are never executed by the in-app assistant: they become a pending
   * action the user confirms with a click (enforced here in code, not by the prompt).
   */
  destructive: boolean;
  /**
   * Arguments that, when present, must come from the user's message — never chosen by the
   * model (an edit value, or a filter like a currency the user didn't ask for).
   */
  userStatedArgs?: string[];
  run(args: A, invoices: InvoicesService): Promise<unknown>;
  /** For destructive tools: what exactly will happen, resolved to a concrete invoice. */
  preview?(args: A, invoices: InvoicesService): Promise<PendingActionPreview>;
}

export interface PendingActionPreview {
  kind: 'delete_invoice' | 'update_invoice_field';
  invoiceId: string;
  summary: string;
  field?: string;
  value?: string | number | null;
}

/** Identity helper: infers each tool's argument type from its own schema. */
export const tool = <A>(t: AssistantTool<A>): AssistantTool<A> => t;

/** The arguments schema as JSON Schema, which is what both tool-calling APIs want. */
export const toolJsonSchema = (t: AssistantTool): Record<string, unknown> => {
  const { $schema: _ignored, ...schema } = z.toJSONSchema(t.schema) as Record<string, unknown>;
  return schema;
};
