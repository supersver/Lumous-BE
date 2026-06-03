import axios, { AxiosError } from 'axios';
import { AppError } from '@middlewares/error.middleware';
import type {
  CreateOpenRouterChatCompletionDto,
  OpenRouterChatCompletionDto,
  OpenRouterChatUsageDto,
} from '@/types/openrouter-chat.dto';

const openRouterChatClient = axios.create({
  baseURL: 'https://openrouter.ai/api/v1',
  timeout: 60_000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const getNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsedValue = Number(value);

    if (Number.isFinite(parsedValue)) {
      return parsedValue;
    }
  }

  return undefined;
};

const getProviderMessage = (data: unknown): string | undefined => {
  if (!isRecord(data)) {
    return undefined;
  }

  const error = data.error;

  if (isRecord(error)) {
    return getString(error.message);
  }

  return getString(data.message);
};

const parseUsage = (usage: unknown): OpenRouterChatUsageDto | undefined => {
  if (!isRecord(usage)) {
    return undefined;
  }

  const promptTokens = getNumber(usage.prompt_tokens);
  const completionTokens = getNumber(usage.completion_tokens);
  const totalTokens = getNumber(usage.total_tokens);
  const estimatedCost = getNumber(usage.cost);

  if (promptTokens === undefined && completionTokens === undefined && totalTokens === undefined) {
    return undefined;
  }

  return {
    promptTokens: promptTokens ?? 0,
    completionTokens: completionTokens ?? 0,
    totalTokens: totalTokens ?? (promptTokens ?? 0) + (completionTokens ?? 0),
    ...(estimatedCost !== undefined ? { estimatedCost: String(estimatedCost) } : {}),
  };
};

const parseChatCompletion = (
  data: unknown,
  requestedModel: string,
  latencyMs: number,
): OpenRouterChatCompletionDto => {
  if (!isRecord(data) || !Array.isArray(data.choices)) {
    throw new AppError(
      'OpenRouter returned an unexpected chat completion response.',
      502,
      'OPENROUTER_CHAT_RESPONSE_INVALID',
    );
  }

  const choices = data.choices as unknown[];
  const firstChoice = choices[0];

  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
    throw new AppError(
      'OpenRouter returned a chat completion without a message.',
      502,
      'OPENROUTER_CHAT_RESPONSE_INVALID',
    );
  }

  const content = getString(firstChoice.message.content);

  if (!content) {
    throw new AppError(
      'OpenRouter returned an empty assistant response.',
      502,
      'OPENROUTER_CHAT_RESPONSE_EMPTY',
    );
  }

  const usage = parseUsage(data.usage);

  return {
    content,
    model: getString(data.model) ?? requestedModel,
    latencyMs,
    ...(usage ? { usage } : {}),
  };
};

const isInvalidModelError = (statusCode: number, providerMessage: string | undefined): boolean => {
  if (statusCode === 404 || statusCode === 422) {
    return true;
  }

  if (statusCode !== 400 || !providerMessage) {
    return false;
  }

  const normalizedMessage = providerMessage.toLowerCase();

  return (
    normalizedMessage.includes('model') ||
    normalizedMessage.includes('endpoint') ||
    normalizedMessage.includes('provider')
  );
};

const handleOpenRouterChatError = (error: unknown): never => {
  if (error instanceof AxiosError) {
    const providerStatus = error.response?.status;
    const providerMessage = getProviderMessage(error.response?.data);

    if (providerStatus === 401 || providerStatus === 403) {
      throw new AppError('Saved OpenRouter API key is invalid.', 401, 'OPENROUTER_API_KEY_INVALID');
    }

    if (providerStatus === 402) {
      throw new AppError(
        'OpenRouter account has insufficient credits.',
        402,
        'OPENROUTER_CREDITS_REQUIRED',
        {
          providerStatus,
          providerMessage,
        },
      );
    }

    if (providerStatus === 429) {
      throw new AppError('OpenRouter rate limit exceeded.', 429, 'OPENROUTER_RATE_LIMITED', {
        providerStatus,
        providerMessage,
      });
    }

    if (providerStatus && isInvalidModelError(providerStatus, providerMessage)) {
      throw new AppError(
        'Invalid or unavailable OpenRouter model.',
        400,
        'OPENROUTER_MODEL_INVALID',
        {
          providerStatus,
          providerMessage,
        },
      );
    }

    if (error.response) {
      throw new AppError(
        'OpenRouter chat completion request failed.',
        502,
        'OPENROUTER_CHAT_FAILED',
        {
          providerStatus,
          providerMessage,
        },
      );
    }

    throw new AppError(
      'Unable to reach OpenRouter chat completions API.',
      502,
      'OPENROUTER_UNAVAILABLE',
    );
  }

  throw error;
};

export const openRouterChatService = {
  async createChatCompletion(
    dto: CreateOpenRouterChatCompletionDto,
  ): Promise<OpenRouterChatCompletionDto> {
    const startedAt = Date.now();

    try {
      const response = await openRouterChatClient.post<unknown>(
        '/chat/completions',
        {
          model: dto.model,
          messages: dto.messages,
          stream: false,
          user: dto.userId,
        },
        {
          headers: {
            Authorization: `Bearer ${dto.apiKey}`,
          },
        },
      );

      return parseChatCompletion(response.data, dto.model, Date.now() - startedAt);
    } catch (error) {
      return handleOpenRouterChatError(error);
    }
  },
};
