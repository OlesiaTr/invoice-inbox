import { Field, Float, ID, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Invoice, InvoiceStatus } from '@prisma/client';
import type { ExtractedInvoice } from '../domain/invoice-data';

registerEnumType(InvoiceStatus, { name: 'InvoiceStatus' });

export enum InvoiceSortField {
  createdAt = 'createdAt',
  issueDate = 'issueDate',
  total = 'total',
  vendorName = 'vendorName',
}
registerEnumType(InvoiceSortField, { name: 'InvoiceSortField' });

export enum SortDirection {
  asc = 'asc',
  desc = 'desc',
}
registerEnumType(SortDirection, { name: 'SortDirection' });

export enum InvoiceEventType {
  INSERT = 'INSERT',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  /** The server lost its database listener for a while: clients should refetch. */
  RESYNC = 'RESYNC',
}
registerEnumType(InvoiceEventType, { name: 'InvoiceEventType' });

@ObjectType()
export class LineItemModel {
  @Field() description: string;
  @Field(() => Float, { nullable: true }) quantity: number | null;
  @Field(() => Float, { nullable: true }) unitPrice: number | null;
  @Field(() => Float, { nullable: true }) amount: number | null;
}

@ObjectType('ExtractedInvoice')
export class ExtractedInvoiceModel {
  @Field(() => String, { nullable: true }) invoiceNumber: string | null;
  @Field(() => String, { nullable: true }) vendorName: string | null;
  @Field(() => String, { nullable: true }) vendorAddress: string | null;
  @Field(() => String, { nullable: true }) customerName: string | null;
  @Field(() => String, { nullable: true, description: 'YYYY-MM-DD' }) issueDate: string | null;
  @Field(() => String, { nullable: true, description: 'YYYY-MM-DD' }) dueDate: string | null;
  @Field(() => String, { nullable: true }) currency: string | null;
  @Field(() => Float, { nullable: true }) subtotal: number | null;
  @Field(() => Float, { nullable: true }) tax: number | null;
  @Field(() => Float, { nullable: true }) total: number | null;
  @Field(() => [LineItemModel]) lineItems: LineItemModel[];
}

@ObjectType('Invoice')
export class InvoiceModel {
  @Field(() => ID) id: string;
  @Field() originalName: string;
  @Field() mimeType: string;
  @Field(() => Int) sizeBytes: number;
  @Field(() => InvoiceStatus) status: InvoiceStatus;
  @Field(() => Int, { description: 'Processing attempts so far (including automatic retries)' })
  attempts: number;
  @Field(() => String, { nullable: true }) errorReason: string | null;
  @Field(() => [String]) warnings: string[];

  @Field(() => String, { nullable: true }) vendorName: string | null;
  @Field(() => String, { nullable: true }) invoiceNumber: string | null;
  @Field(() => String, { nullable: true, description: 'YYYY-MM-DD' }) issueDate: string | null;
  @Field(() => Float, { nullable: true }) total: number | null;
  @Field(() => String, { nullable: true }) currency: string | null;

  @Field(() => ExtractedInvoiceModel, { nullable: true }) extractedData: ExtractedInvoice | null;
  @Field(() => String, { nullable: true, description: 'Text the AI read (PDF text layer or OCR), for debugging' })
  rawText: string | null;

  @Field() createdAt: Date;
  @Field() updatedAt: Date;
  @Field(() => Date, { nullable: true }) completedAt: Date | null;
}

export function toInvoiceModel(i: Invoice): InvoiceModel {
  return {
    id: i.id,
    originalName: i.originalName,
    mimeType: i.mimeType,
    sizeBytes: i.sizeBytes,
    status: i.status,
    attempts: i.attempts,
    errorReason: i.errorReason,
    warnings: i.warnings,
    vendorName: i.vendorName,
    invoiceNumber: i.invoiceNumber,
    issueDate: i.issueDate ? i.issueDate.toISOString().slice(0, 10) : null,
    total: i.total == null ? null : Number(i.total),
    currency: i.currency,
    extractedData: i.extractedData as ExtractedInvoice | null,
    rawText: i.rawText,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
    completedAt: i.completedAt,
  };
}

@ObjectType()
export class StatusCounts {
  @Field(() => Int) all: number;
  @Field(() => Int) uploaded: number;
  @Field(() => Int) processing: number;
  @Field(() => Int) completed: number;
  @Field(() => Int) failed: number;
}

@ObjectType()
export class InvoicePage {
  @Field(() => [InvoiceModel]) items: InvoiceModel[];
  @Field(() => Int) total: number;
}

@ObjectType()
export class InvoiceEvent {
  @Field(() => InvoiceEventType) type: InvoiceEventType;
  @Field(() => ID, { nullable: true }) id: string | null;
  @Field(() => InvoiceStatus, { nullable: true }) status: InvoiceStatus | null;
  @Field(() => Date, { nullable: true }) updatedAt: Date | null;
}

@ObjectType()
export class RetryAllResult {
  @Field(() => Int) retried: number;
}

@InputType()
export class InvoicesFilter {
  @Field(() => InvoiceStatus, { nullable: true }) status?: InvoiceStatus;
  @Field({ nullable: true }) search?: string;
  @Field(() => InvoiceSortField, { nullable: true }) sortBy?: InvoiceSortField;
  @Field(() => SortDirection, { nullable: true }) sortDir?: SortDirection;
  @Field(() => Int, { nullable: true }) limit?: number;
  @Field(() => Int, { nullable: true }) offset?: number;
}

@InputType()
export class UpdateInvoiceFieldsInput {
  @Field(() => String, { nullable: true }) invoiceNumber?: string | null;
  @Field(() => String, { nullable: true }) vendorName?: string | null;
  @Field(() => String, { nullable: true }) vendorAddress?: string | null;
  @Field(() => String, { nullable: true }) customerName?: string | null;
  @Field(() => String, { nullable: true }) issueDate?: string | null;
  @Field(() => String, { nullable: true }) dueDate?: string | null;
  @Field(() => String, { nullable: true }) currency?: string | null;
  @Field(() => Float, { nullable: true }) subtotal?: number | null;
  @Field(() => Float, { nullable: true }) tax?: number | null;
  @Field(() => Float, { nullable: true }) total?: number | null;
}
