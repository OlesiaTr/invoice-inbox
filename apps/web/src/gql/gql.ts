/* eslint-disable */
import * as types from './graphql';



/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "fragment InvoiceRowFields on Invoice {\n  id\n  originalName\n  mimeType\n  status\n  attempts\n  errorReason\n  warnings\n  vendorName\n  invoiceNumber\n  issueDate\n  total\n  currency\n  createdAt\n  updatedAt\n}": typeof types.InvoiceRowFieldsFragmentDoc,
    "mutation AssistantChat($messages: [ChatMessageInput!]!) {\n  assistantChat(messages: $messages) {\n    reply\n    actions {\n      tool\n      ok\n      summary\n    }\n    pendingActions {\n      id\n      kind\n      invoiceId\n      summary\n      field\n      valueJson\n    }\n  }\n}": typeof types.AssistantChatDocument,
    "mutation DeleteInvoice($id: ID!) {\n  deleteInvoice(id: $id) {\n    id\n  }\n}": typeof types.DeleteInvoiceDocument,
    "mutation RetryAllFailedInvoices {\n  retryAllFailedInvoices {\n    retried\n  }\n}": typeof types.RetryAllFailedInvoicesDocument,
    "mutation RetryInvoice($id: ID!) {\n  retryInvoice(id: $id) {\n    ...InvoiceRowFields\n  }\n}": typeof types.RetryInvoiceDocument,
    "mutation UpdateInvoiceFields($id: ID!, $input: UpdateInvoiceFieldsInput!) {\n  updateInvoiceFields(id: $id, input: $input) {\n    id\n  }\n}": typeof types.UpdateInvoiceFieldsDocument,
    "query GetInvoice($id: ID!) {\n  invoice(id: $id) {\n    ...InvoiceRowFields\n    sizeBytes\n    completedAt\n    rawText\n    extractedData {\n      invoiceNumber\n      vendorName\n      vendorAddress\n      customerName\n      issueDate\n      dueDate\n      currency\n      subtotal\n      tax\n      total\n      lineItems {\n        description\n        quantity\n        unitPrice\n        amount\n      }\n    }\n  }\n}": typeof types.GetInvoiceDocument,
    "query GetInvoices($filter: InvoicesFilter) {\n  invoices(filter: $filter) {\n    total\n    items {\n      ...InvoiceRowFields\n    }\n  }\n}": typeof types.GetInvoicesDocument,
    "query GetStatusCounts {\n  statusCounts {\n    all\n    uploaded\n    processing\n    completed\n    failed\n  }\n}": typeof types.GetStatusCountsDocument,
    "subscription InvoiceEvents {\n  invoiceEvents {\n    type\n    id\n    status\n    updatedAt\n  }\n}": typeof types.InvoiceEventsDocument,
};
const documents: Documents = {
    "fragment InvoiceRowFields on Invoice {\n  id\n  originalName\n  mimeType\n  status\n  attempts\n  errorReason\n  warnings\n  vendorName\n  invoiceNumber\n  issueDate\n  total\n  currency\n  createdAt\n  updatedAt\n}": types.InvoiceRowFieldsFragmentDoc,
    "mutation AssistantChat($messages: [ChatMessageInput!]!) {\n  assistantChat(messages: $messages) {\n    reply\n    actions {\n      tool\n      ok\n      summary\n    }\n    pendingActions {\n      id\n      kind\n      invoiceId\n      summary\n      field\n      valueJson\n    }\n  }\n}": types.AssistantChatDocument,
    "mutation DeleteInvoice($id: ID!) {\n  deleteInvoice(id: $id) {\n    id\n  }\n}": types.DeleteInvoiceDocument,
    "mutation RetryAllFailedInvoices {\n  retryAllFailedInvoices {\n    retried\n  }\n}": types.RetryAllFailedInvoicesDocument,
    "mutation RetryInvoice($id: ID!) {\n  retryInvoice(id: $id) {\n    ...InvoiceRowFields\n  }\n}": types.RetryInvoiceDocument,
    "mutation UpdateInvoiceFields($id: ID!, $input: UpdateInvoiceFieldsInput!) {\n  updateInvoiceFields(id: $id, input: $input) {\n    id\n  }\n}": types.UpdateInvoiceFieldsDocument,
    "query GetInvoice($id: ID!) {\n  invoice(id: $id) {\n    ...InvoiceRowFields\n    sizeBytes\n    completedAt\n    rawText\n    extractedData {\n      invoiceNumber\n      vendorName\n      vendorAddress\n      customerName\n      issueDate\n      dueDate\n      currency\n      subtotal\n      tax\n      total\n      lineItems {\n        description\n        quantity\n        unitPrice\n        amount\n      }\n    }\n  }\n}": types.GetInvoiceDocument,
    "query GetInvoices($filter: InvoicesFilter) {\n  invoices(filter: $filter) {\n    total\n    items {\n      ...InvoiceRowFields\n    }\n  }\n}": types.GetInvoicesDocument,
    "query GetStatusCounts {\n  statusCounts {\n    all\n    uploaded\n    processing\n    completed\n    failed\n  }\n}": types.GetStatusCountsDocument,
    "subscription InvoiceEvents {\n  invoiceEvents {\n    type\n    id\n    status\n    updatedAt\n  }\n}": types.InvoiceEventsDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "fragment InvoiceRowFields on Invoice {\n  id\n  originalName\n  mimeType\n  status\n  attempts\n  errorReason\n  warnings\n  vendorName\n  invoiceNumber\n  issueDate\n  total\n  currency\n  createdAt\n  updatedAt\n}"): typeof import('./graphql').InvoiceRowFieldsFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation AssistantChat($messages: [ChatMessageInput!]!) {\n  assistantChat(messages: $messages) {\n    reply\n    actions {\n      tool\n      ok\n      summary\n    }\n    pendingActions {\n      id\n      kind\n      invoiceId\n      summary\n      field\n      valueJson\n    }\n  }\n}"): typeof import('./graphql').AssistantChatDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation DeleteInvoice($id: ID!) {\n  deleteInvoice(id: $id) {\n    id\n  }\n}"): typeof import('./graphql').DeleteInvoiceDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation RetryAllFailedInvoices {\n  retryAllFailedInvoices {\n    retried\n  }\n}"): typeof import('./graphql').RetryAllFailedInvoicesDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation RetryInvoice($id: ID!) {\n  retryInvoice(id: $id) {\n    ...InvoiceRowFields\n  }\n}"): typeof import('./graphql').RetryInvoiceDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation UpdateInvoiceFields($id: ID!, $input: UpdateInvoiceFieldsInput!) {\n  updateInvoiceFields(id: $id, input: $input) {\n    id\n  }\n}"): typeof import('./graphql').UpdateInvoiceFieldsDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query GetInvoice($id: ID!) {\n  invoice(id: $id) {\n    ...InvoiceRowFields\n    sizeBytes\n    completedAt\n    rawText\n    extractedData {\n      invoiceNumber\n      vendorName\n      vendorAddress\n      customerName\n      issueDate\n      dueDate\n      currency\n      subtotal\n      tax\n      total\n      lineItems {\n        description\n        quantity\n        unitPrice\n        amount\n      }\n    }\n  }\n}"): typeof import('./graphql').GetInvoiceDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query GetInvoices($filter: InvoicesFilter) {\n  invoices(filter: $filter) {\n    total\n    items {\n      ...InvoiceRowFields\n    }\n  }\n}"): typeof import('./graphql').GetInvoicesDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query GetStatusCounts {\n  statusCounts {\n    all\n    uploaded\n    processing\n    completed\n    failed\n  }\n}"): typeof import('./graphql').GetStatusCountsDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "subscription InvoiceEvents {\n  invoiceEvents {\n    type\n    id\n    status\n    updatedAt\n  }\n}"): typeof import('./graphql').InvoiceEventsDocument;


export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}
