import type { TokenUsageDto } from '@/types/message.dto';

export type StreamChatStartEventDto = {
  messageId: string;
};

export type StreamChatTokenEventDto = {
  content: string;
};

export type StreamChatCompleteEventDto = {
  messageId: string;
  usage: TokenUsageDto | null;
};

export type StreamChatErrorEventDto = {
  message: string;
};

export type StreamChatSseEvents = {
  start: StreamChatStartEventDto;
  token: StreamChatTokenEventDto;
  complete: StreamChatCompleteEventDto;
  error: StreamChatErrorEventDto;
};

export type StreamChatMessageCallbacks = {
  onStart: (event: StreamChatStartEventDto) => Promise<void> | void;
  onToken: (event: StreamChatTokenEventDto) => Promise<void> | void;
  onComplete: (event: StreamChatCompleteEventDto) => Promise<void> | void;
};
