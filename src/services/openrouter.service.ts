import { createHash } from 'node:crypto';
import axios, { AxiosError } from 'axios';
import { MemoryCache } from '@lib/memory-cache';
import { AppError } from '@middlewares/error.middleware';
import { apiKeyService } from '@services/api-key.service';
import { buildModelsResponse } from '@/utils/model-normalizer';
import type { ModelsResponseDto } from '@/types/model.dto';

const MODEL_CACHE_TTL_MS = 15 * 60 * 1000;
const modelsCache = new MemoryCache<ModelsResponseDto>(MODEL_CACHE_TTL_MS);

const openRouterClient = axios.create({
  baseURL: 'https://openrouter.ai/api/v1',
  timeout: 15_000,
  headers: { Accept: 'application/json' },
});

const getCacheKey = (apiKey: string): string =>
  `openrouter-models:${createHash('sha256').update(apiKey, 'utf8').digest('hex')}`;

const getProviderMessage = (data: unknown): string | undefined => {
  if (typeof data !== 'object' || data === null) return undefined;
  const d = data as Record<string, unknown>;
  const err = d.error;
  if (typeof err === 'object' && err !== null) {
    const msg = (err as Record<string, unknown>).message;
    return typeof msg === 'string' ? msg : undefined;
  }
  return typeof d.message === 'string' ? d.message : undefined;
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

const fetchModels = async (apiKey: string): Promise<ModelsResponseDto> => {
  try {
    const { data } = await openRouterClient.get<unknown>('/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return buildModelsResponse(data);
  } catch (error) {
    return handleOpenRouterError(error);
  }
};

export const openRouterService = {
  async listModelsForUser(userId: string): Promise<ModelsResponseDto> {
    const apiKey = await apiKeyService.getActiveOpenRouterApiKeyForUser(userId);
    const cacheKey = getCacheKey(apiKey);
    const cached = modelsCache.get(cacheKey);

    if (cached) return cached;

    const response = await fetchModels(apiKey);
    modelsCache.set(cacheKey, response);
    return response;
  },
};
