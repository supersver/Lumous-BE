import type { MessageRole } from '@prisma/client';
import { AppError } from '@middlewares/error.middleware';
import { z, type ZodError } from 'zod';

const maxModelIdLength = 256;

const validationDetails = (error: ZodError) => ({
  issues: error.issues.map((issue) => ({
    field: issue.path.join('.') || 'body',
    message: issue.message,
  })),
});

const parseSchema = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new AppError(
      'Validation failed.',
      400,
      'VALIDATION_ERROR',
      validationDetails(result.error),
    );
  }

  return result.data;
};

const createChatSchema = z
  .object({
    model: z.string().trim().min(1, 'Model is required.').max(maxModelIdLength),
  })
  .strict();

const listChatsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strip();

const chatIdParamSchema = z.string().uuid('Invalid chat id.');

export type CreateChatDto = z.infer<typeof createChatSchema>;
export type ListChatsQueryDto = z.infer<typeof listChatsQuerySchema>;

export type ChatResponseDto = {
  id: string;
  title: string;
  model: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ChatSummaryDto = {
  id: string;
  title: string;
  model: string;
  updatedAt: Date;
};

export type ChatDetailMessageDto = {
  id: string;
  chatId: string;
  role: MessageRole;
  content: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  createdAt: Date;
};

export type ChatDetailsDto = ChatResponseDto & {
  messages: ChatDetailMessageDto[];
};

export const parseCreateChatDto = (body: unknown): CreateChatDto =>
  parseSchema(createChatSchema, body);

export const parseListChatsQueryDto = (query: unknown): ListChatsQueryDto =>
  parseSchema(listChatsQuerySchema, query);

export const parseChatIdParam = (chatId: unknown): string =>
  parseSchema(chatIdParamSchema, chatId);
