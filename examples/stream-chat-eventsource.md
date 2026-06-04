# Streaming Chat Frontend Example

Native `EventSource` only supports `GET`, so this `POST /chats/:chatId/messages/stream`
endpoint needs an EventSource-compatible fetch wrapper such as `@microsoft/fetch-event-source`.

```ts
import { fetchEventSource } from '@microsoft/fetch-event-source';

type StreamCompleteUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost?: string;
  latencyMs: number;
};

export const streamChatMessage = async (input: {
  baseUrl: string;
  firebaseIdToken: string;
  chatId: string;
  model: string;
  content: string;
  onAssistantMessageId: (messageId: string) => void;
  onToken: (content: string) => void;
  onComplete: (messageId: string, usage: StreamCompleteUsage | null) => void;
  onError: (message: string) => void;
  signal?: AbortSignal;
}): Promise<void> => {
  await fetchEventSource(`${input.baseUrl}/chats/${input.chatId}/messages/stream`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.firebaseIdToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: input.model,
      content: input.content,
    }),
    signal: input.signal,
    onmessage(message) {
      const data: unknown = JSON.parse(message.data);

      if (message.event === 'start') {
        input.onAssistantMessageId((data as { messageId: string }).messageId);
        return;
      }

      if (message.event === 'token') {
        input.onToken((data as { content: string }).content);
        return;
      }

      if (message.event === 'complete') {
        const complete = data as { messageId: string; usage: StreamCompleteUsage | null };
        input.onComplete(complete.messageId, complete.usage);
        return;
      }

      if (message.event === 'error') {
        input.onError((data as { message: string }).message);
      }
    },
  });
};
```
