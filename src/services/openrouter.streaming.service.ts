import { AppError } from '@middlewares/error.middleware';
import type {
  CreateOpenRouterChatCompletionDto,
  OpenRouterChatUsageDto,
} from '@/types/openrouter-chat.dto';

const openRouterChatCompletionsUrl = 'https://openrouter.ai/api/v1/chat/completions';
const textDecoder = new TextDecoder();

type OpenRouterStreamingHandlers = {
  onToken: (content: string) => Promise<void> | void;
  onModel?: (model: string) => Promise<void> | void;
};

type OpenRouterStreamingCompletionDto = {
  content: string;
  model: string;
  usage?: OpenRouterChatUsageDto;
  latencyMs: number;
  cancelled: boolean;
};

type OpenRouterErrorBody = {
  error?: {
    code?: string | number;
    message?: string;
    type?: string;
  };
  message?: string;
};

type OpenRouterStreamChoice = {
  delta?: {
    content?: unknown;
  };
  finish_reason?: unknown;
};

type OpenRouterStreamChunk = {
  id?: unknown;
  model?: unknown;
  choices?: unknown;
  usage?: unknown;
  error?: unknown;
};

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

const readOpenRouterErrorBody = async (response: Response): Promise<OpenRouterErrorBody | null> => {
  try {
    const body: unknown = await response.json();
    return isRecord(body) ? body : null;
  } catch {
    return null;
  }
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

const throwOpenRouterHttpError = async (response: Response): Promise<never> => {
  const providerStatus = response.status;
  const body = await readOpenRouterErrorBody(response);
  const providerMessage = getProviderMessage(body);

  if (providerStatus === 401 || providerStatus === 403) {
    throw new AppError('Saved OpenRouter API key is invalid.', 400, 'OPENROUTER_API_KEY_INVALID');
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

  if (isInvalidModelError(providerStatus, providerMessage)) {
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

  throw new AppError('OpenRouter streaming request failed.', 502, 'OPENROUTER_STREAM_FAILED', {
    providerStatus,
    providerMessage,
  });
};

const parseStreamChunk = (rawData: string): OpenRouterStreamChunk | null => {
  if (rawData === '[DONE]') {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(rawData);
    return isRecord(parsed) ? parsed : null;
  } catch {
    throw new AppError(
      'OpenRouter returned an invalid streaming chunk.',
      502,
      'OPENROUTER_STREAM_CHUNK_INVALID',
    );
  }
};

const getStreamErrorMessage = (error: unknown): string | undefined => {
  if (!isRecord(error)) {
    return undefined;
  }

  return getString(error.message);
};

const throwStreamChunkError = (chunk: OpenRouterStreamChunk): never => {
  throw new AppError(
    getStreamErrorMessage(chunk.error) ?? 'OpenRouter reported a streaming error.',
    502,
    'OPENROUTER_STREAM_ERROR',
    {
      providerError: chunk.error,
    },
  );
};

const getChoices = (choices: unknown): OpenRouterStreamChoice[] => {
  if (!Array.isArray(choices)) {
    return [];
  }

  return choices.filter(isRecord).map((choice) => choice as OpenRouterStreamChoice);
};

const getTokenContent = (chunk: OpenRouterStreamChunk): string[] =>
  getChoices(chunk.choices)
    .map((choice) => choice.delta?.content)
    .filter((content): content is string => typeof content === 'string' && content.length > 0);

const processSseFrame = async (
  frame: string,
  state: {
    contentParts: string[];
    model: string;
    usage?: OpenRouterChatUsageDto;
    isDone: boolean;
    cancelled: boolean;
  },
  handlers: OpenRouterStreamingHandlers,
  signal?: AbortSignal,
): Promise<void> => {
  if (signal?.aborted) {
    state.cancelled = true;
    return;
  }

  const dataLines = frame
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trim());

  if (dataLines.length === 0) {
    return;
  }

  const chunk = parseStreamChunk(dataLines.join('\n'));

  if (!chunk) {
    state.isDone = true;
    return;
  }

  if (chunk.error) {
    throwStreamChunkError(chunk);
  }

  const chunkModel = getString(chunk.model);

  if (chunkModel) {
    state.model = chunkModel;
    await handlers.onModel?.(chunkModel);
  }

  const usage = parseUsage(chunk.usage);

  if (usage) {
    state.usage = usage;
  }

  const tokenContents = getTokenContent(chunk);

  for (const tokenContent of tokenContents) {
    if (signal?.aborted || state.cancelled) {
      state.cancelled = true;
      break;
    }

    state.contentParts.push(tokenContent);
    await handlers.onToken(tokenContent);
  }
};

const streamSseFrames = async (
  body: ReadableStream<Uint8Array>,
  state: {
    contentParts: string[];
    model: string;
    usage?: OpenRouterChatUsageDto;
    isDone: boolean;
    cancelled: boolean;
  },
  handlers: OpenRouterStreamingHandlers,
  signal?: AbortSignal,
): Promise<void> => {
  const reader = body.getReader();
  let buffer = '';
  const abortReader = (): void => {
    state.cancelled = true;
    void reader.cancel().catch(() => undefined);
  };

  try {
    if (signal?.aborted) {
      state.cancelled = true;
      return;
    }

    signal?.addEventListener('abort', abortReader, { once: true });

    while (!state.isDone && !state.cancelled) {
      let value: Uint8Array | undefined;
      let done = false;

      try {
        const result = await reader.read();
        value = result.value;
        done = result.done;
      } catch (error) {
        if (signal?.aborted) {
          state.cancelled = true;
          break;
        }

        throw error;
      }

      if (done) {
        break;
      }

      buffer += textDecoder.decode(value, { stream: true });

      let boundaryIndex = buffer.search(/\r?\n\r?\n/);

      while (boundaryIndex >= 0 && !state.cancelled) {
        const frame = buffer.slice(0, boundaryIndex);
        const boundaryMatch = buffer.slice(boundaryIndex).match(/^\r?\n\r?\n/);
        const boundaryLength = boundaryMatch?.[0].length ?? 2;
        buffer = buffer.slice(boundaryIndex + boundaryLength);

        await processSseFrame(frame, state, handlers, signal);
        boundaryIndex = buffer.search(/\r?\n\r?\n/);
      }
    }

    buffer += textDecoder.decode();

    if (buffer.trim().length > 0 && !state.isDone && !state.cancelled) {
      await processSseFrame(buffer, state, handlers, signal);
    }
  } finally {
    signal?.removeEventListener('abort', abortReader);

    if (state.cancelled) {
      await reader.cancel().catch(() => undefined);
    }

    reader.releaseLock();
  }
};

export const openRouterStreamingService = {
  async createStreamingChatCompletion(
    dto: CreateOpenRouterChatCompletionDto,
    handlers: OpenRouterStreamingHandlers,
    signal?: AbortSignal,
  ): Promise<OpenRouterStreamingCompletionDto> {
    const startedAt = Date.now();
    let response: Response;

    try {
      if (signal?.aborted) {
        return {
          content: '',
          model: dto.model,
          latencyMs: Date.now() - startedAt,
          cancelled: true,
        };
      }

      response = await fetch(openRouterChatCompletionsUrl, {
        method: 'POST',
        headers: {
          Accept: 'text/event-stream',
          Authorization: `Bearer ${dto.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: dto.model,
          messages: dto.messages,
          stream: true,
          user: dto.userId,
        }),
        signal: signal ?? null,
      });
    } catch {
      if (signal?.aborted) {
        return {
          content: '',
          model: dto.model,
          latencyMs: Date.now() - startedAt,
          cancelled: true,
        };
      }

      throw new AppError(
        'Unable to reach OpenRouter streaming API.',
        502,
        'OPENROUTER_UNAVAILABLE',
      );
    }

    if (!response.ok) {
      if (signal?.aborted) {
        await response.body?.cancel().catch(() => undefined);

        return {
          content: '',
          model: dto.model,
          latencyMs: Date.now() - startedAt,
          cancelled: true,
        };
      }

      await throwOpenRouterHttpError(response);
    }

    if (signal?.aborted) {
      await response.body?.cancel().catch(() => undefined);

      return {
        content: '',
        model: dto.model,
        latencyMs: Date.now() - startedAt,
        cancelled: true,
      };
    }

    if (!response.body) {
      throw new AppError(
        'OpenRouter returned an empty streaming response.',
        502,
        'OPENROUTER_STREAM_EMPTY',
      );
    }

    const state: {
      contentParts: string[];
      model: string;
      usage?: OpenRouterChatUsageDto;
      isDone: boolean;
      cancelled: boolean;
    } = {
      contentParts: [],
      model: dto.model,
      isDone: false,
      cancelled: false,
    };

    await streamSseFrames(response.body, state, handlers, signal);

    return {
      content: state.contentParts.join(''),
      model: state.model,
      latencyMs: Date.now() - startedAt,
      cancelled: state.cancelled || Boolean(signal?.aborted),
      ...(state.usage ? { usage: state.usage } : {}),
    };
  },
};
