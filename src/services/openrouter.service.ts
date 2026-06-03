import { createHash } from 'node:crypto';
import axios, { AxiosError } from 'axios';
import { MemoryCache } from '@lib/memory-cache';
import { AppError } from '@middlewares/error.middleware';
import { apiKeyService } from '@services/api-key.service';
import type { ModelDto } from '@/types/model.dto';

const modelCacheTtlMs = 10 * 60 * 1000;
const modelsCache = new MemoryCache<ModelDto[]>(modelCacheTtlMs);

const openRouterClient = axios.create({
  baseURL: 'https://openrouter.ai/api/v1',
  timeout: 15_000,
  headers: {
    Accept: 'application/json',
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

const getPricingValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return '0';
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

const getCacheKey = (apiKey: string): string =>
  `openrouter-models:${createHash('sha256').update(apiKey, 'utf8').digest('hex')}`;

const parseOpenRouterModels = (data: unknown): ModelDto[] => {
  if (!isRecord(data) || !Array.isArray(data.data)) {
    throw new AppError(
      'OpenRouter returned an unexpected models response.',
      502,
      'OPENROUTER_MODELS_RESPONSE_INVALID',
    );
  }

  return data.data.flatMap((item): ModelDto[] => {
    if (!isRecord(item)) {
      return [];
    }

    const id = getString(item.id);

    if (!id) {
      return [];
    }

    const pricing = isRecord(item.pricing) ? item.pricing : {};

    return [
      {
        id,
        name: getString(item.name) ?? id,
        contextLength: getNumber(item.context_length) ?? 0,
        pricing: {
          prompt: getPricingValue(pricing.prompt),
          completion: getPricingValue(pricing.completion),
        },
      },
    ];
  });
};

const handleOpenRouterError = (error: unknown): never => {
  if (error instanceof AxiosError) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      throw new AppError('Saved OpenRouter API key is invalid.', 401, 'OPENROUTER_API_KEY_INVALID');
    }

    if (error.response) {
      throw new AppError(
        'OpenRouter models request failed.',
        502,
        'OPENROUTER_MODELS_REQUEST_FAILED',
        {
          providerStatus: error.response.status,
          providerMessage: getProviderMessage(error.response.data),
        },
      );
    }

    throw new AppError('Unable to reach OpenRouter models API.', 502, 'OPENROUTER_UNAVAILABLE');
  }

  throw error;
};

const fetchModels = async (apiKey: string): Promise<ModelDto[]> => {
  try {
    const response = await openRouterClient.get<unknown>('/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    return parseOpenRouterModels(response.data);
  } catch (error) {
    return handleOpenRouterError(error);
  }
};

export const openRouterService = {
  async listModelsForUser(userId: string): Promise<ModelDto[]> {
    const apiKey = await apiKeyService.getActiveOpenRouterApiKeyForUser(userId);
    const cacheKey = getCacheKey(apiKey);
    const cachedModels = modelsCache.get(cacheKey);

    if (cachedModels) {
      return cachedModels;
    }

    const models = await fetchModels(apiKey);
    modelsCache.set(cacheKey, models);

    return models;
  },
};
