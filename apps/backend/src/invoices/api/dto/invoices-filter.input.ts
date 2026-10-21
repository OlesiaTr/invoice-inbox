import { Field, InputType, Int, registerEnumType } from '@nestjs/graphql';
import { InvoiceStatus } from '@prisma/client';

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

@InputType()
export class InvoicesFilter {
  @Field(() => InvoiceStatus, { nullable: true }) status?: InvoiceStatus;
  @Field({ nullable: true }) search?: string;
  @Field(() => InvoiceSortField, { nullable: true }) sortBy?: InvoiceSortField;
  @Field(() => SortDirection, { nullable: true }) sortDir?: SortDirection;
  @Field(() => Int, { nullable: true }) limit?: number;
  @Field(() => Int, { nullable: true }) offset?: number;
}
