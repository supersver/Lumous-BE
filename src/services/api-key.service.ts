import type { ApiKey } from '@prisma/client';
import { encryptSecret, decryptSecret } from '@lib/encryption';
import { prisma } from '@lib/prisma';
import { AppError } from '@middlewares/error.middleware';
import type { ApiKeyProvider, ApiKeyResponseDto, CreateApiKeyDto } from '@/types/api-key.dto';

const openRouterCurrentKeyUrl = 'https://openrouter.ai/api/v1/key';
const openRouterKeyPrefix = 'sk-or-v1-';

type OpenRouterErrorBody = {
  error?: {
    message?: string;
    type?: string;
  };
  message?: string;
};

const isOpenRouterErrorBody = (value: unknown): value is OpenRouterErrorBody =>
  typeof value === 'object' && value !== null;

const getOpenRouterErrorMessage = async (response: Response): Promise<string | undefined> => {
  try {
    const body: unknown = await response.json();

    if (!isOpenRouterErrorBody(body)) {
      return undefined;
    }

    if (typeof body.error?.message === 'string') {
      return body.error.message;
    }

    if (typeof body.message === 'string') {
      return body.message;
    }

    return undefined;
  } catch {
    return undefined;
  }
};

const verifyOpenRouterApiKey = async (apiKey: string): Promise<void> => {
  let response: Response;

  try {
    response = await fetch(openRouterCurrentKeyUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });
  } catch {
    throw new AppError(
      'Unable to reach OpenRouter to verify the API key.',
      502,
      'OPENROUTER_VERIFICATION_UNAVAILABLE',
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new AppError('OpenRouter rejected the API key.', 400, 'API_KEY_INVALID');
  }

  if (!response.ok) {
    const providerMessage = await getOpenRouterErrorMessage(response);

    throw new AppError(
      'Unable to verify OpenRouter API key.',
      502,
      'OPENROUTER_VERIFICATION_FAILED',
      {
        providerStatus: response.status,
        providerMessage,
      },
    );
  }
};

const verifyProviderApiKey = async (provider: ApiKeyProvider, apiKey: string): Promise<void> => {
  if (provider === 'openrouter') {
    await verifyOpenRouterApiKey(apiKey);
    return;
  }

  throw new AppError('Unsupported API key provider.', 400, 'API_KEY_PROVIDER_UNSUPPORTED');
};

const maskApiKey = (apiKey: string): string => {
  const suffix = apiKey.slice(-4);

  if (apiKey.startsWith(openRouterKeyPrefix)) {
    return `${openRouterKeyPrefix}****${suffix}`;
  }

  return `****${suffix}`;
};

const toApiKeyResponseDto = (apiKey: ApiKey, plainTextApiKey: string): ApiKeyResponseDto => ({
  id: apiKey.id,
  provider: apiKey.provider as ApiKeyProvider,
  maskedKey: maskApiKey(plainTextApiKey),
  createdAt: apiKey.createdAt,
  updatedAt: apiKey.updatedAt,
});

const toStoredApiKeyResponseDto = (apiKey: ApiKey): ApiKeyResponseDto => {
  try {
    return toApiKeyResponseDto(apiKey, decryptSecret(apiKey.encryptedKey));
  } catch {
    throw new AppError('Stored API key could not be decrypted.', 500, 'API_KEY_DECRYPTION_FAILED');
  }
};

const decryptStoredApiKey = (encryptedApiKey: string): string => {
  try {
    return decryptSecret(encryptedApiKey);
  } catch {
    throw new AppError(
      'Stored OpenRouter API key could not be decrypted.',
      500,
      'API_KEY_DECRYPTION_FAILED',
    );
  }
};

export const apiKeyService = {
  async createForUser(userId: string, dto: CreateApiKeyDto): Promise<ApiKeyResponseDto> {
    await verifyProviderApiKey(dto.provider, dto.apiKey);

    const createdApiKey = await prisma.apiKey.create({
      data: {
        userId,
        provider: dto.provider,
        encryptedKey: encryptSecret(dto.apiKey),
      },
    });

    return toApiKeyResponseDto(createdApiKey, dto.apiKey);
  },

  async listForUser(userId: string): Promise<ApiKeyResponseDto[]> {
    const apiKeys = await prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return apiKeys.map(toStoredApiKeyResponseDto);
  },

  async deleteForUser(userId: string, apiKeyId: string): Promise<void> {
    const result = await prisma.apiKey.deleteMany({
      where: {
        id: apiKeyId,
        userId,
      },
    });

    if (result.count === 0) {
      throw new AppError('API key not found.', 404, 'API_KEY_NOT_FOUND');
    }
  },

  async getActiveOpenRouterApiKeyForUser(userId: string): Promise<string> {
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        userId,
        provider: 'openrouter',
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!apiKey) {
      throw new AppError(
        'No active OpenRouter API key found for this user.',
        404,
        'OPENROUTER_API_KEY_MISSING',
      );
    }

    return decryptStoredApiKey(apiKey.encryptedKey);
  },
};
