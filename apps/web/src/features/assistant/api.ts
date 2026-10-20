import { useMutation } from '@tanstack/react-query';
import { AssistantChatDocument, type AssistantChatMutation, type ChatMessageInput } from '@/gql/graphql';
import { gql } from '@/shared/graphql';

export type AssistantReply = AssistantChatMutation['assistantChat'];
export type PendingAction = AssistantReply['pendingActions'][number];

export function useAssistantChat() {
  return useMutation({
    mutationFn: (messages: ChatMessageInput[]) => gql(AssistantChatDocument, { messages }).then((d) => d.assistantChat),
  });
}
