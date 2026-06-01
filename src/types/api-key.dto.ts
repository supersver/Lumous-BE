import { AppError } from '@middlewares/error.middleware';

const supportedProviders = ['openrouter'] as const;
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ApiKeyProvider = (typeof supportedProviders)[number];

export type CreateApiKeyDto = {
  provider: ApiKeyProvider;
  apiKey: string;
};

export type ApiKeyResponseDto = {
  id: string;
  provider: ApiKeyProvider;
  maskedKey: string;
  createdAt: Date;
  updatedAt: Date;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const validateProvider = (provider: unknown): ApiKeyProvider => {
  if (typeof provider !== 'string' || !provider.trim()) {
    throw new AppError('Provider is required.', 400, 'VALIDATION_ERROR', {
      field: 'provider',
    });
  }

  const normalizedProvider = provider.trim().toLowerCase();

  if (!supportedProviders.includes(normalizedProvider as ApiKeyProvider)) {
    throw new AppError('Unsupported API key provider.', 400, 'VALIDATION_ERROR', {
      field: 'provider',
      supportedProviders,
    });
  }

  return normalizedProvider as ApiKeyProvider;
};

const validateApiKey = (apiKey: unknown): string => {
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    throw new AppError('API key is required.', 400, 'VALIDATION_ERROR', {
      field: 'apiKey',
    });
  }

  const trimmedApiKey = apiKey.trim();

  if (trimmedApiKey.length < 12) {
    throw new AppError('API key is too short.', 400, 'VALIDATION_ERROR', {
      field: 'apiKey',
    });
  }

  return trimmedApiKey;
};

export const parseCreateApiKeyDto = (body: unknown): CreateApiKeyDto => {
  if (!isRecord(body)) {
    throw new AppError('Request body must be a JSON object.', 400, 'VALIDATION_ERROR');
  }

  return {
    provider: validateProvider(body.provider),
    apiKey: validateApiKey(body.apiKey),
  };
};

export const parseApiKeyIdParam = (id: unknown): string => {
  if (typeof id !== 'string' || !uuidRegex.test(id)) {
    throw new AppError('Invalid API key id.', 400, 'VALIDATION_ERROR', {
      field: 'id',
    });
  }

  return id;
};
