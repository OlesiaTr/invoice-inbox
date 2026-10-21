import { Field, Float, InputType } from '@nestjs/graphql';

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
