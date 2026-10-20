import { Args, Field, ID, InputType, Mutation, ObjectType, Resolver, registerEnumType } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import { AssistantService } from './assistant.service';

enum ChatRole {
  user = 'user',
  assistant = 'assistant',
}
registerEnumType(ChatRole, { name: 'ChatRole' });

enum PendingActionKind {
  delete_invoice = 'delete_invoice',
  update_invoice_field = 'update_invoice_field',
}
registerEnumType(PendingActionKind, { name: 'PendingActionKind' });

@InputType()
class ChatMessageInput {
  @Field(() => ChatRole) role: ChatRole;
  @Field() content: string;
}

@ObjectType()
class AssistantAction {
  @Field() tool: string;
  @Field() ok: boolean;
  @Field() summary: string;
}

@ObjectType({ description: 'A destructive action the assistant proposed; runs only if the user confirms it in the UI' })
class PendingAction {
  @Field(() => ID) id: string;
  @Field(() => PendingActionKind) kind: PendingActionKind;
  @Field(() => ID) invoiceId: string;
  @Field() summary: string;
  @Field(() => String, { nullable: true }) field?: string;
  @Field(() => String, { nullable: true, description: 'JSON-encoded new value (string, number or null)' })
  valueJson?: string;
}

@ObjectType()
class AssistantReply {
  @Field() reply: string;
  @Field(() => [AssistantAction]) actions: AssistantAction[];
  @Field(() => [PendingAction]) pendingActions: PendingAction[];
}

@Resolver()
export class AssistantResolver {
  constructor(private readonly assistant: AssistantService) {}

  // Each turn can fan out into several model calls; this is the most expensive thing
  // an anonymous caller can trigger.
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Mutation(() => AssistantReply, { description: 'One assistant turn. The client sends the visible conversation.' })
  async assistantChat(
    @Args('messages', { type: () => [ChatMessageInput] }) messages: ChatMessageInput[],
  ): Promise<AssistantReply> {
    const res = await this.assistant.chat(messages);
    return {
      ...res,
      pendingActions: res.pendingActions.map((p) => ({
        id: p.id,
        kind: p.kind as PendingActionKind,
        invoiceId: p.invoiceId,
        summary: p.summary,
        field: p.field,
        valueJson: p.field ? JSON.stringify(p.value ?? null) : undefined,
      })),
    };
  }
}
