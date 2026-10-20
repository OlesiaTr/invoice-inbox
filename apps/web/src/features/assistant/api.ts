import { useMutation } from '@tanstack/react-query';
import { graphql } from '@/gql';
import type { AssistantChatMutation, ChatMessageInput } from '@/gql/graphql';
import { gql } from '@/shared/graphql';

const AssistantChatMutationDoc = graphql(`
  mutation AssistantChat($messages: [ChatMessageInput!]!) {
    assistantChat(messages: $messages) {
      reply
      actions {
        tool
        ok
        summary
      }
      pendingActions {
        id
        kind
        invoiceId
        summary
        field
        valueJson
      }
    }
  }
`);

export type AssistantReply = AssistantChatMutation['assistantChat'];
export type PendingAction = AssistantReply['pendingActions'][number];

export function useAssistantChat() {
  return useMutation({
    mutationFn: (messages: ChatMessageInput[]) =>
      gql(AssistantChatMutationDoc, { messages }).then((d) => d.assistantChat),
  });
}
