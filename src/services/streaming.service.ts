import { randomUUID } from 'node:crypto';
import { MessageRole, Prisma, UsageStatus, type Message } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { AppError } from '@middlewares/error.middleware';
import { apiKeyService } from '@services/api-key.service';
import { openRouterStreamingService } from '@services/openrouter.streaming.service';
import { generateChatTitle } from '@utils/generate-chat-title';
import type { CreateChatMessageDto, TokenUsageDto } from '@/types/message.dto';
import type {
  OpenRouterChatMessageDto,
  OpenRouterChatRole,
  OpenRouterChatUsageDto,
} from '@/types/openrouter-chat.dto';
import type { StreamChatMessageCallbacks } from '@/types/streaming.dto';

const openRouterProvider = 'openrouter';

type StreamChatMessageInput = {
  userId: string;
  chatId: string;
  dto: CreateChatMessageDto;
  signal: AbortSignal;
  callbacks: StreamChatMessageCallbacks;
};

type CompletionPersistenceInput = {
  userId: string;
  chatId: string;
  messageId: string;
  model: string;
  content: string;
  usage?: TokenUsageDto;
  latencyMs: number;
  status: UsageStatus;
};

const toOpenRouterRole = (role: MessageRole): OpenRouterChatRole => {
  if (role === MessageRole.system) {
    return 'system';
  }

  if (role === MessageRole.assistant) {
    return 'assistant';
  }

  return 'user';
};

const toOpenRouterMessage = (message: Message): OpenRouterChatMessageDto => ({
  role: toOpenRouterRole(message.role),
  content: message.content,
});

const toTokenUsage = (
  usage: OpenRouterChatUsageDto | undefined,
  latencyMs: number,
): TokenUsageDto | undefined => {
  if (!usage) {
    return undefined;
  }

  return {
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.totalTokens,
    latencyMs,
    ...(usage.estimatedCost ? { estimatedCost: usage.estimatedCost } : {}),
  };
};

const getUsageNumbers = (
  usage: TokenUsageDto | undefined,
): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: Prisma.Decimal;
} => ({
  promptTokens: usage?.promptTokens ?? 0,
  completionTokens: usage?.completionTokens ?? 0,
  totalTokens: usage?.totalTokens ?? 0,
  estimatedCost: new Prisma.Decimal(usage?.estimatedCost ?? 0),
});

const persistCompletion = async (input: CompletionPersistenceInput): Promise<void> => {
  const usageNumbers = getUsageNumbers(input.usage);

  await prisma.$transaction([
    prisma.message.create({
      data: {
        id: input.messageId,
        chatId: input.chatId,
        role: MessageRole.assistant,
        content: input.content,
        promptTokens: input.usage?.promptTokens ?? null,
        completionTokens: input.usage?.completionTokens ?? null,
        totalTokens: input.usage?.totalTokens ?? null,
      },
    }),
    prisma.usageLog.create({
      data: {
        userId: input.userId,
        chatId: input.chatId,
        provider: openRouterProvider,
        model: input.model,
        promptTokens: usageNumbers.promptTokens,
        completionTokens: usageNumbers.completionTokens,
        totalTokens: usageNumbers.totalTokens,
        estimatedCost: usageNumbers.estimatedCost,
        latencyMs: input.latencyMs,
        status: input.status,
      },
    }),
    prisma.chat.update({
      where: { id: input.chatId },
      data: {
        model: input.model,
        provider: openRouterProvider,
      },
    }),
  ]);
};

const persistFailedUsageLog = async (
  userId: string,
  chatId: string,
  model: string,
  latencyMs: number,
): Promise<void> => {
  await prisma.usageLog.create({
    data: {
      userId,
      chatId,
      provider: openRouterProvider,
      model,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCost: new Prisma.Decimal(0),
      latencyMs,
      status: UsageStatus.failed,
    },
  });
};

const safePersistFailure = async (
  userId: string,
  chatId: string,
  model: string,
  latencyMs: number,
): Promise<void> => {
  try {
    await persistFailedUsageLog(userId, chatId, model, latencyMs);
  } catch (error) {
    console.error('Failed to write usage log for streaming failure.', error);
  }
};

export const streamingService = {
  async streamChatCompletion(input: StreamChatMessageInput): Promise<void> {
    const chat = await prisma.chat.findFirst({
      where: {
        id: input.chatId,
        userId: input.userId,
      },
    });

    if (!chat) {
      throw new AppError('Chat not found.', 404, 'CHAT_NOT_FOUND');
    }

    // Generate title if chat still has default "New Chat" title
    const generatedTitle =
      chat.title === 'New Chat' ? generateChatTitle(input.dto.content) : undefined;

    await prisma.$transaction([
      prisma.message.create({
        data: {
          chatId: input.chatId,
          role: MessageRole.user,
          content: input.dto.content,
        },
      }),
      prisma.chat.update({
        where: { id: input.chatId },
        data: {
          model: input.dto.model,
          provider: openRouterProvider,
          ...(generatedTitle ? { title: generatedTitle } : {}),
        },
      }),
    ]);

    const history = await prisma.message.findMany({
      where: { chatId: input.chatId },
      orderBy: { createdAt: 'asc' },
    });

    const openRouterMessages = history.map(toOpenRouterMessage);
    const assistantMessageId = randomUUID();
    const startedAt = Date.now();
    let streamedContent = '';
    let streamedModel = input.dto.model;
    let completionPersisted = false;

    try {
      const apiKey = await apiKeyService.getActiveOpenRouterApiKeyForUser(input.userId);

      await input.callbacks.onStart({ messageId: assistantMessageId });

      const completion = await openRouterStreamingService.createStreamingChatCompletion(
        {
          apiKey,
          model: input.dto.model,
          messages: openRouterMessages,
          userId: input.userId,
        },
        {
          onToken: async (content) => {
            streamedContent += content;
            await input.callbacks.onToken({ content });
          },
          onModel: (model) => {
            streamedModel = model;
          },
        },
        input.signal,
      );
      const usage = toTokenUsage(completion.usage, completion.latencyMs);
      const status = usage ? UsageStatus.success : UsageStatus.partial;

      await persistCompletion({
        userId: input.userId,
        chatId: input.chatId,
        messageId: assistantMessageId,
        model: completion.model,
        content: completion.content,
        latencyMs: completion.latencyMs,
        status,
        ...(usage ? { usage } : {}),
      });
      completionPersisted = true;

      await input.callbacks.onComplete({
        messageId: assistantMessageId,
        usage: usage ?? null,
      });
    } catch (error) {
      const latencyMs = Date.now() - startedAt;

      if (completionPersisted) {
        throw error;
      }

      if (streamedContent.length > 0) {
        await persistCompletion({
          userId: input.userId,
          chatId: input.chatId,
          messageId: assistantMessageId,
          model: streamedModel,
          content: streamedContent,
          latencyMs,
          status: UsageStatus.partial,
        });
      } else {
        await safePersistFailure(input.userId, input.chatId, streamedModel, latencyMs);
      }

      throw error;
    }
  },
};
