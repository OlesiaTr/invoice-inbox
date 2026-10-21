import { Field, Int, ObjectType } from '@nestjs/graphql';
import { InvoiceModel } from './invoice.model';

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
export class RetryAllResult {
  @Field(() => Int) retried: number;
}
