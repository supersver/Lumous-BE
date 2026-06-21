export type OpenRouterChatRole = 'system' | 'user' | 'assistant';

export type OpenRouterChatMessageDto = {
  role: OpenRouterChatRole;
  content: string;
};

export type OpenRouterReasoningEffort = 'xhigh' | 'high' | 'medium' | 'low' | 'minimal' | 'none';

export type OpenRouterReasoningConfigDto = {
  enabled?: boolean;
  effort?: OpenRouterReasoningEffort;
  max_tokens?: number;
  exclude?: boolean;
};

export type OpenRouterPluginDto = {
  id: 'web';
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
  reasoning?: OpenRouterReasoningConfigDto;
  plugins?: OpenRouterPluginDto[];
  userId: string;
};