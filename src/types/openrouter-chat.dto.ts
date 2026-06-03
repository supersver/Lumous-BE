export type OpenRouterChatRole = 'system' | 'user' | 'assistant';

export type OpenRouterChatMessageDto = {
  role: OpenRouterChatRole;
  content: string;
};

export type OpenRouterChatUsageDto = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost?: string;
};

export type OpenRouterChatCompletionDto = {
  content: string;
  model: string;
  usage?: OpenRouterChatUsageDto;
  latencyMs: number;
};

export type CreateOpenRouterChatCompletionDto = {
  apiKey: string;
  model: string;
  messages: OpenRouterChatMessageDto[];
  userId: string;
};
