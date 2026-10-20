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
    "\n  mutation AssistantChat($messages: [ChatMessageInput!]!) {\n    assistantChat(messages: $messages) {\n      reply\n      actions {\n        tool\n        ok\n        summary\n      }\n      pendingActions {\n        id\n        kind\n        invoiceId\n        summary\n        field\n        valueJson\n      }\n    }\n  }\n": typeof types.AssistantChatDocument,
    "\n  fragment InvoiceRow on Invoice {\n    id\n    originalName\n    mimeType\n    status\n    attempts\n    errorReason\n    warnings\n    vendorName\n    invoiceNumber\n    issueDate\n    total\n    currency\n    createdAt\n    updatedAt\n  }\n": typeof types.InvoiceRowFragmentDoc,
    "\n  query Invoices($filter: InvoicesFilter) {\n    invoices(filter: $filter) {\n      total\n      items {\n        ...InvoiceRow\n      }\n    }\n  }\n": typeof types.InvoicesDocument,
    "\n  query StatusCounts {\n    statusCounts {\n      all\n      uploaded\n      processing\n      completed\n      failed\n    }\n  }\n": typeof types.StatusCountsDocument,
    "\n  query Invoice($id: ID!) {\n    invoice(id: $id) {\n      ...InvoiceRow\n      sizeBytes\n      completedAt\n      rawText\n      extractedData {\n        invoiceNumber\n        vendorName\n        vendorAddress\n        customerName\n        issueDate\n        dueDate\n        currency\n        subtotal\n        tax\n        total\n        lineItems {\n          description\n          quantity\n          unitPrice\n          amount\n        }\n      }\n    }\n  }\n": typeof types.InvoiceDocument,
    "\n  mutation RetryInvoice($id: ID!) {\n    retryInvoice(id: $id) {\n      ...InvoiceRow\n    }\n  }\n": typeof types.RetryInvoiceDocument,
    "\n  mutation RetryAllFailed {\n    retryAllFailedInvoices {\n      retried\n    }\n  }\n": typeof types.RetryAllFailedDocument,
    "\n  mutation DeleteInvoice($id: ID!) {\n    deleteInvoice(id: $id) {\n      id\n    }\n  }\n": typeof types.DeleteInvoiceDocument,
    "\n  mutation UpdateInvoiceFields($id: ID!, $input: UpdateInvoiceFieldsInput!) {\n    updateInvoiceFields(id: $id, input: $input) {\n      id\n    }\n  }\n": typeof types.UpdateInvoiceFieldsDocument,
    "\n  subscription InvoiceEvents {\n    invoiceEvents {\n      type\n      id\n      status\n      updatedAt\n    }\n  }\n": typeof types.InvoiceEventsDocument,
};
const documents: Documents = {
    "\n  mutation AssistantChat($messages: [ChatMessageInput!]!) {\n    assistantChat(messages: $messages) {\n      reply\n      actions {\n        tool\n        ok\n        summary\n      }\n      pendingActions {\n        id\n        kind\n        invoiceId\n        summary\n        field\n        valueJson\n      }\n    }\n  }\n": types.AssistantChatDocument,
    "\n  fragment InvoiceRow on Invoice {\n    id\n    originalName\n    mimeType\n    status\n    attempts\n    errorReason\n    warnings\n    vendorName\n    invoiceNumber\n    issueDate\n    total\n    currency\n    createdAt\n    updatedAt\n  }\n": types.InvoiceRowFragmentDoc,
    "\n  query Invoices($filter: InvoicesFilter) {\n    invoices(filter: $filter) {\n      total\n      items {\n        ...InvoiceRow\n      }\n    }\n  }\n": types.InvoicesDocument,
    "\n  query StatusCounts {\n    statusCounts {\n      all\n      uploaded\n      processing\n      completed\n      failed\n    }\n  }\n": types.StatusCountsDocument,
    "\n  query Invoice($id: ID!) {\n    invoice(id: $id) {\n      ...InvoiceRow\n      sizeBytes\n      completedAt\n      rawText\n      extractedData {\n        invoiceNumber\n        vendorName\n        vendorAddress\n        customerName\n        issueDate\n        dueDate\n        currency\n        subtotal\n        tax\n        total\n        lineItems {\n          description\n          quantity\n          unitPrice\n          amount\n        }\n      }\n    }\n  }\n": types.InvoiceDocument,
    "\n  mutation RetryInvoice($id: ID!) {\n    retryInvoice(id: $id) {\n      ...InvoiceRow\n    }\n  }\n": types.RetryInvoiceDocument,
    "\n  mutation RetryAllFailed {\n    retryAllFailedInvoices {\n      retried\n    }\n  }\n": types.RetryAllFailedDocument,
    "\n  mutation DeleteInvoice($id: ID!) {\n    deleteInvoice(id: $id) {\n      id\n    }\n  }\n": types.DeleteInvoiceDocument,
    "\n  mutation UpdateInvoiceFields($id: ID!, $input: UpdateInvoiceFieldsInput!) {\n    updateInvoiceFields(id: $id, input: $input) {\n      id\n    }\n  }\n": types.UpdateInvoiceFieldsDocument,
    "\n  subscription InvoiceEvents {\n    invoiceEvents {\n      type\n      id\n      status\n      updatedAt\n    }\n  }\n": types.InvoiceEventsDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation AssistantChat($messages: [ChatMessageInput!]!) {\n    assistantChat(messages: $messages) {\n      reply\n      actions {\n        tool\n        ok\n        summary\n      }\n      pendingActions {\n        id\n        kind\n        invoiceId\n        summary\n        field\n        valueJson\n      }\n    }\n  }\n"): typeof import('./graphql').AssistantChatDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment InvoiceRow on Invoice {\n    id\n    originalName\n    mimeType\n    status\n    attempts\n    errorReason\n    warnings\n    vendorName\n    invoiceNumber\n    issueDate\n    total\n    currency\n    createdAt\n    updatedAt\n  }\n"): typeof import('./graphql').InvoiceRowFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Invoices($filter: InvoicesFilter) {\n    invoices(filter: $filter) {\n      total\n      items {\n        ...InvoiceRow\n      }\n    }\n  }\n"): typeof import('./graphql').InvoicesDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query StatusCounts {\n    statusCounts {\n      all\n      uploaded\n      processing\n      completed\n      failed\n    }\n  }\n"): typeof import('./graphql').StatusCountsDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Invoice($id: ID!) {\n    invoice(id: $id) {\n      ...InvoiceRow\n      sizeBytes\n      completedAt\n      rawText\n      extractedData {\n        invoiceNumber\n        vendorName\n        vendorAddress\n        customerName\n        issueDate\n        dueDate\n        currency\n        subtotal\n        tax\n        total\n        lineItems {\n          description\n          quantity\n          unitPrice\n          amount\n        }\n      }\n    }\n  }\n"): typeof import('./graphql').InvoiceDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RetryInvoice($id: ID!) {\n    retryInvoice(id: $id) {\n      ...InvoiceRow\n    }\n  }\n"): typeof import('./graphql').RetryInvoiceDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RetryAllFailed {\n    retryAllFailedInvoices {\n      retried\n    }\n  }\n"): typeof import('./graphql').RetryAllFailedDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteInvoice($id: ID!) {\n    deleteInvoice(id: $id) {\n      id\n    }\n  }\n"): typeof import('./graphql').DeleteInvoiceDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateInvoiceFields($id: ID!, $input: UpdateInvoiceFieldsInput!) {\n    updateInvoiceFields(id: $id, input: $input) {\n      id\n    }\n  }\n"): typeof import('./graphql').UpdateInvoiceFieldsDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  subscription InvoiceEvents {\n    invoiceEvents {\n      type\n      id\n      status\n      updatedAt\n    }\n  }\n"): typeof import('./graphql').InvoiceEventsDocument;


export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}
