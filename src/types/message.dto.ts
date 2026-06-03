import type { MessageRole } from '@prisma/client';
import { AppError } from '@middlewares/error.middleware';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maxMessageContentLength = 50_000;
const maxModelIdLength = 256;

export type CreateChatMessageDto = {
  content: string;
  model: string;
};

export type TokenUsageDto = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost?: string;
  latencyMs: number;
};

export type ChatMessageDto = {
  id: string;
  chatId: string;
  role: MessageRole;
  content: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  createdAt: Date;
};

export type ChatCompletionResponseDto = {
  message: ChatMessageDto;
  usage?: TokenUsageDto;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const validateContent = (content: unknown): string => {
  if (typeof content !== 'string' || !content.trim()) {
    throw new AppError('Message content is required.', 400, 'VALIDATION_ERROR', {
      field: 'content',
    });
  }

  const trimmedContent = content.trim();

  if (trimmedContent.length > maxMessageContentLength) {
    throw new AppError('Message content is too long.', 400, 'VALIDATION_ERROR', {
      field: 'content',
      maxLength: maxMessageContentLength,
    });
  }

  return trimmedContent;
};

const validateModel = (model: unknown): string => {
  if (typeof model !== 'string' || !model.trim()) {
    throw new AppError('Model is required.', 400, 'VALIDATION_ERROR', {
      field: 'model',
    });
  }

  const trimmedModel = model.trim();

  if (trimmedModel.length > maxModelIdLength) {
    throw new AppError('Model id is too long.', 400, 'VALIDATION_ERROR', {
      field: 'model',
      maxLength: maxModelIdLength,
    });
  }

  return trimmedModel;
};

export const parseCreateChatMessageDto = (body: unknown): CreateChatMessageDto => {
  if (!isRecord(body)) {
    throw new AppError('Request body must be a JSON object.', 400, 'VALIDATION_ERROR');
  }

  return {
    content: validateContent(body.content),
    model: validateModel(body.model),
  };
};

export const parseChatIdParam = (chatId: unknown): string => {
  if (typeof chatId !== 'string' || !uuidRegex.test(chatId)) {
    throw new AppError('Invalid chat id.', 400, 'VALIDATION_ERROR', {
      field: 'chatId',
    });
  }

  return chatId;
};
