import { Field, ID, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum ChatRole {
  user = 'user',
  assistant = 'assistant',
}
registerEnumType(ChatRole, { name: 'ChatRole' });

export enum PendingActionKind {
  delete_invoice = 'delete_invoice',
  update_invoice_field = 'update_invoice_field',
}
registerEnumType(PendingActionKind, { name: 'PendingActionKind' });

@InputType()
export class ChatMessageInput {
  @Field(() => ChatRole) role: ChatRole;
  @Field() content: string;
}

@ObjectType()
export class AssistantAction {
  @Field() tool: string;
  @Field() ok: boolean;
  @Field() summary: string;
}

@ObjectType({ description: 'A destructive action the assistant proposed; runs only if the user confirms it in the UI' })
export class PendingAction {
  @Field(() => ID) id: string;
  @Field(() => PendingActionKind) kind: PendingActionKind;
  @Field(() => ID) invoiceId: string;
  @Field() summary: string;
  @Field(() => String, { nullable: true }) field?: string;
  @Field(() => String, { nullable: true, description: 'JSON-encoded new value (string, number or null)' })
  valueJson?: string;
}

@ObjectType()
export class AssistantReply {
  @Field() reply: string;
  @Field(() => [AssistantAction]) actions: AssistantAction[];
  @Field(() => [PendingAction]) pendingActions: PendingAction[];
}
