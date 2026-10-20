/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type { DocumentTypeDecoration } from '@graphql-typed-document-node/core';
export type ChatMessageInput = {
  content: string;
  role: ChatRole;
};

export type ChatRole =
  | 'assistant'
  | 'user';

export type InvoiceEventType =
  | 'DELETE'
  | 'INSERT'
  | 'RESYNC'
  | 'UPDATE';

export type InvoiceSortField =
  | 'createdAt'
  | 'issueDate'
  | 'total'
  | 'vendorName';

export type InvoiceStatus =
  | 'completed'
  | 'failed'
  | 'processing'
  | 'uploaded';

export type InvoicesFilter = {
  limit?: number | null | undefined;
  offset?: number | null | undefined;
  search?: string | null | undefined;
  sortBy?: InvoiceSortField | null | undefined;
  sortDir?: SortDirection | null | undefined;
  status?: InvoiceStatus | null | undefined;
};

export type PendingActionKind =
  | 'delete_invoice'
  | 'update_invoice_field';

export type SortDirection =
  | 'asc'
  | 'desc';

export type UpdateInvoiceFieldsInput = {
  currency?: string | null | undefined;
  customerName?: string | null | undefined;
  dueDate?: string | null | undefined;
  invoiceNumber?: string | null | undefined;
  issueDate?: string | null | undefined;
  subtotal?: number | null | undefined;
  tax?: number | null | undefined;
  total?: number | null | undefined;
  vendorAddress?: string | null | undefined;
  vendorName?: string | null | undefined;
};

export type AssistantChatMutationVariables = Exact<{
  messages: Array<ChatMessageInput> | ChatMessageInput;
}>;


export type AssistantChatMutation = { assistantChat: { reply: string, actions: Array<{ tool: string, ok: boolean, summary: string }>, pendingActions: Array<{ id: string, kind: PendingActionKind, invoiceId: string, summary: string, field: string | null, valueJson: string | null }> } };

export type InvoiceRowFragment = { id: string, originalName: string, mimeType: string, status: InvoiceStatus, attempts: number, errorReason: string | null, warnings: Array<string>, vendorName: string | null, invoiceNumber: string | null, issueDate: string | null, total: number | null, currency: string | null, createdAt: string, updatedAt: string };

export type InvoicesQueryVariables = Exact<{
  filter?: InvoicesFilter | null | undefined;
}>;


export type InvoicesQuery = { invoices: { total: number, items: Array<{ id: string, originalName: string, mimeType: string, status: InvoiceStatus, attempts: number, errorReason: string | null, warnings: Array<string>, vendorName: string | null, invoiceNumber: string | null, issueDate: string | null, total: number | null, currency: string | null, createdAt: string, updatedAt: string }> } };

export type StatusCountsQueryVariables = Exact<{ [key: string]: never; }>;


export type StatusCountsQuery = { statusCounts: { all: number, uploaded: number, processing: number, completed: number, failed: number } };

export type InvoiceQueryVariables = Exact<{
  id: string | number;
}>;


export type InvoiceQuery = { invoice: { sizeBytes: number, completedAt: string | null, rawText: string | null, id: string, originalName: string, mimeType: string, status: InvoiceStatus, attempts: number, errorReason: string | null, warnings: Array<string>, vendorName: string | null, invoiceNumber: string | null, issueDate: string | null, total: number | null, currency: string | null, createdAt: string, updatedAt: string, extractedData: { invoiceNumber: string | null, vendorName: string | null, vendorAddress: string | null, customerName: string | null, issueDate: string | null, dueDate: string | null, currency: string | null, subtotal: number | null, tax: number | null, total: number | null, lineItems: Array<{ description: string, quantity: number | null, unitPrice: number | null, amount: number | null }> } | null } };

export type RetryInvoiceMutationVariables = Exact<{
  id: string | number;
}>;


export type RetryInvoiceMutation = { retryInvoice: { id: string, originalName: string, mimeType: string, status: InvoiceStatus, attempts: number, errorReason: string | null, warnings: Array<string>, vendorName: string | null, invoiceNumber: string | null, issueDate: string | null, total: number | null, currency: string | null, createdAt: string, updatedAt: string } };

export type RetryAllFailedMutationVariables = Exact<{ [key: string]: never; }>;


export type RetryAllFailedMutation = { retryAllFailedInvoices: { retried: number } };

export type DeleteInvoiceMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteInvoiceMutation = { deleteInvoice: { id: string } };

export type UpdateInvoiceFieldsMutationVariables = Exact<{
  id: string | number;
  input: UpdateInvoiceFieldsInput;
}>;


export type UpdateInvoiceFieldsMutation = { updateInvoiceFields: { id: string } };

export type InvoiceEventsSubscriptionVariables = Exact<{ [key: string]: never; }>;


export type InvoiceEventsSubscription = { invoiceEvents: { type: InvoiceEventType, id: string | null, status: InvoiceStatus | null, updatedAt: string | null } };

export class TypedDocumentString<TResult, TVariables>
  extends String
  implements DocumentTypeDecoration<TResult, TVariables>
{
  __apiType?: NonNullable<DocumentTypeDecoration<TResult, TVariables>['__apiType']>;
  private value: string;
  public __meta__?: Record<string, any> | undefined;

  constructor(value: string, __meta__?: Record<string, any> | undefined) {
    super(value);
    this.value = value;
    this.__meta__ = __meta__;
  }

  override toString(): string & DocumentTypeDecoration<TResult, TVariables> {
    return this.value;
  }
}
export const InvoiceRowFragmentDoc = new TypedDocumentString(`
    fragment InvoiceRow on Invoice {
  id
  originalName
  mimeType
  status
  attempts
  errorReason
  warnings
  vendorName
  invoiceNumber
  issueDate
  total
  currency
  createdAt
  updatedAt
}
    `, {"fragmentName":"InvoiceRow"}) as unknown as TypedDocumentString<InvoiceRowFragment, unknown>;
export const AssistantChatDocument = new TypedDocumentString(`
    mutation AssistantChat($messages: [ChatMessageInput!]!) {
  assistantChat(messages: $messages) {
    reply
    actions {
      tool
      ok
      summary
    }
    pendingActions {
      id
      kind
      invoiceId
      summary
      field
      valueJson
    }
  }
}
    `) as unknown as TypedDocumentString<AssistantChatMutation, AssistantChatMutationVariables>;
export const InvoicesDocument = new TypedDocumentString(`
    query Invoices($filter: InvoicesFilter) {
  invoices(filter: $filter) {
    total
    items {
      ...InvoiceRow
    }
  }
}
    fragment InvoiceRow on Invoice {
  id
  originalName
  mimeType
  status
  attempts
  errorReason
  warnings
  vendorName
  invoiceNumber
  issueDate
  total
  currency
  createdAt
  updatedAt
}`) as unknown as TypedDocumentString<InvoicesQuery, InvoicesQueryVariables>;
export const StatusCountsDocument = new TypedDocumentString(`
    query StatusCounts {
  statusCounts {
    all
    uploaded
    processing
    completed
    failed
  }
}
    `) as unknown as TypedDocumentString<StatusCountsQuery, StatusCountsQueryVariables>;
export const InvoiceDocument = new TypedDocumentString(`
    query Invoice($id: ID!) {
  invoice(id: $id) {
    ...InvoiceRow
    sizeBytes
    completedAt
    rawText
    extractedData {
      invoiceNumber
      vendorName
      vendorAddress
      customerName
      issueDate
      dueDate
      currency
      subtotal
      tax
      total
      lineItems {
        description
        quantity
        unitPrice
        amount
      }
    }
  }
}
    fragment InvoiceRow on Invoice {
  id
  originalName
  mimeType
  status
  attempts
  errorReason
  warnings
  vendorName
  invoiceNumber
  issueDate
  total
  currency
  createdAt
  updatedAt
}`) as unknown as TypedDocumentString<InvoiceQuery, InvoiceQueryVariables>;
export const RetryInvoiceDocument = new TypedDocumentString(`
    mutation RetryInvoice($id: ID!) {
  retryInvoice(id: $id) {
    ...InvoiceRow
  }
}
    fragment InvoiceRow on Invoice {
  id
  originalName
  mimeType
  status
  attempts
  errorReason
  warnings
  vendorName
  invoiceNumber
  issueDate
  total
  currency
  createdAt
  updatedAt
}`) as unknown as TypedDocumentString<RetryInvoiceMutation, RetryInvoiceMutationVariables>;
export const RetryAllFailedDocument = new TypedDocumentString(`
    mutation RetryAllFailed {
  retryAllFailedInvoices {
    retried
  }
}
    `) as unknown as TypedDocumentString<RetryAllFailedMutation, RetryAllFailedMutationVariables>;
export const DeleteInvoiceDocument = new TypedDocumentString(`
    mutation DeleteInvoice($id: ID!) {
  deleteInvoice(id: $id) {
    id
  }
}
    `) as unknown as TypedDocumentString<DeleteInvoiceMutation, DeleteInvoiceMutationVariables>;
export const UpdateInvoiceFieldsDocument = new TypedDocumentString(`
    mutation UpdateInvoiceFields($id: ID!, $input: UpdateInvoiceFieldsInput!) {
  updateInvoiceFields(id: $id, input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<UpdateInvoiceFieldsMutation, UpdateInvoiceFieldsMutationVariables>;
export const InvoiceEventsDocument = new TypedDocumentString(`
    subscription InvoiceEvents {
  invoiceEvents {
    type
    id
    status
    updatedAt
  }
}
    `) as unknown as TypedDocumentString<InvoiceEventsSubscription, InvoiceEventsSubscriptionVariables>;