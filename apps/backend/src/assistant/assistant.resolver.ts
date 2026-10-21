import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import { AssistantService } from './assistant.service';
import { AssistantReply, ChatMessageInput, PendingActionKind } from './dto/assistant-chat.dto';

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
