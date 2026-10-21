import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import { Invoice, InvoiceStatus } from '@prisma/client';
import type { ExtractedInvoice } from '../../domain/invoice-data';

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

export const toInvoiceModel = (i: Invoice): InvoiceModel => {
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
};
