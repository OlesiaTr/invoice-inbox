import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { InvoiceStatus } from '@prisma/client';

export enum InvoiceEventType {
  INSERT = 'INSERT',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  /** The server lost its database listener for a while: clients should refetch. */
  RESYNC = 'RESYNC',
}
registerEnumType(InvoiceEventType, { name: 'InvoiceEventType' });

@ObjectType()
export class InvoiceEvent {
  @Field(() => InvoiceEventType) type: InvoiceEventType;
  @Field(() => ID, { nullable: true }) id: string | null;
  @Field(() => InvoiceStatus, { nullable: true }) status: InvoiceStatus | null;
  @Field(() => Date, { nullable: true }) updatedAt: Date | null;
}
