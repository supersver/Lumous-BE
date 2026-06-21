import { randomUUID } from 'node:crypto';
import { MessageRole, Prisma, UsageStatus, type Message } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { AppError } from '@middlewares/error.middleware';
import { apiKeyService } from '@services/api-key.service';
import { openRouterService } from '@services/openrouter.service';
import { openRouterStreamingService } from '@services/openrouter.streaming.service';
import {
  isStreamCancelledError,
  type StreamCancellation,
} from '@services/stream-cancellation.service';
import { generateChatTitle } from '@utils/generate-chat-title';
import type { CreateChatMessageDto, MessageMetadataDto, TokenUsageDto } from '@/types/message.dto';
import type {
  OpenRouterChatMessageDto,
  OpenRouterChatRole,
  OpenRouterChatUsageDto,
  OpenRouterReasoningConfigDto,
} from '@/types/openrouter-chat.dto';
import type { StreamChatMessageCallbacks } from '@/types/streaming.dto';

const openRouterProvider = 'openrouter';

const reasoningModelHints = [
  'thinking',
  'reasoning',
  '/o1',
  '/o3',
  '/o4',
  'deepseek-r1',
  'grok-3',
  'grok-4',
];

type StreamChatMessageInput = {
  userId: string;
  chatId: string;
  dto: CreateChatMessageDto;
  cancellation: StreamCancellation;
  callbacks: StreamChatMessageCallbacks;
};

type CompletionPersistenceInput = {
  userId: string;
  chatId: string;
  messageId: string;
  model: string;
  content: string;
  metadata: MessageMetadataDto;
  usage?: TokenUsageDto;
  latencyMs: number;
  status: UsageStatus;
};

const createMessageMetadata = (dto: CreateChatMessageDto): MessageMetadataDto => ({
  reasoning: dto.reasoning,
  webSearch: dto.webSearch,
});

const toPrismaMetadata = (metadata: MessageMetadataDto): Prisma.InputJsonObject => ({
  reasoning: metadata.reasoning,
  webSearch: metadata.webSearch,
});

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

const modelLooksReasoningCapable = (model: string): boolean => {
  const normalizedModel = model.toLowerCase();
  return reasoningModelHints.some((hint) => normalizedModel.includes(hint));
};

const resolveCompletionModel = async (
  userId: string,
  requestedModel: string,
  reasoning: boolean,
): Promise<string> => {
  if (!reasoning) {
    return requestedModel;
  }

  const modelsResponse = await openRouterService.listModelsForUser(userId);
  const requestedModelInfo = modelsResponse.models.find((model) => model.id === requestedModel);

  if (
    requestedModelInfo?.supportsReasoning ||
    (!requestedModelInfo && modelLooksReasoningCapable(requestedModel))
  ) {
    return requestedModel;
  }

  const reasoningModels = modelsResponse.models.filter((model) => model.supportsReasoning);

  if (reasoningModels.length === 0) {
    throw new AppError(
      'No reasoning-capable OpenRouter model is available for this account.',
      400,
      'OPENROUTER_REASONING_MODEL_UNAVAILABLE',
    );
  }

  const requestedProviderSlug = requestedModel.split('/')[0];
  const sameProviderModel = reasoningModels.find(
    (model) => model.providerSlug === requestedProviderSlug,
  );

  return (
    sameProviderModel?.id ??
    reasoningModels.find((model) => model.featured)?.id ??
    reasoningModels[0]!.id
  );
};

const getReasoningConfig = (): OpenRouterReasoningConfigDto => ({
  enabled: true,
  effort: 'medium',
  exclude: true,
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
        metadata: toPrismaMetadata(input.metadata),
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

const persistUsageLog = async (
  userId: string,
  chatId: string,
  model: string,
  latencyMs: number,
  status: UsageStatus,
  usage?: TokenUsageDto,
): Promise<void> => {
  const usageNumbers = getUsageNumbers(usage);

  await prisma.usageLog.create({
    data: {
      userId,
      chatId,
      provider: openRouterProvider,
      model,
      promptTokens: usageNumbers.promptTokens,
      completionTokens: usageNumbers.completionTokens,
      totalTokens: usageNumbers.totalTokens,
      estimatedCost: usageNumbers.estimatedCost,
      latencyMs,
      status,
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

    const metadata = createMessageMetadata(input.dto);
    const requestedModel = input.dto.model ?? chat.model;

    // Generate title if chat still has default "New Chat" title
    const generatedTitle =
      chat.title === 'New Chat' ? generateChatTitle(input.dto.content) : undefined;

    await prisma.$transaction([
      prisma.message.create({
        data: {
          chatId: input.chatId,
          role: MessageRole.user,
          content: input.dto.content,
          metadata: toPrismaMetadata(metadata),
        },
      }),
      prisma.chat.update({
        where: { id: input.chatId },
        data: {
          model: requestedModel,
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
    let completionModel = requestedModel;
    let streamedContent = '';
    let streamedModel = requestedModel;
    let streamedUsage: TokenUsageDto | undefined;
    let completionPersisted = false;

    const persistCancelledCompletion = async (latencyMs: number): Promise<void> => {
      if (streamedContent.length > 0) {
        await persistCompletion({
          userId: input.userId,
          chatId: input.chatId,
          messageId: assistantMessageId,
          model: streamedModel,
          content: streamedContent,
          metadata,
          latencyMs,
          status: UsageStatus.cancelled,
          ...(streamedUsage ? { usage: streamedUsage } : {}),
        });
        completionPersisted = true;
        return;
      }

      await persistUsageLog(
        input.userId,
        input.chatId,
        streamedModel,
        latencyMs,
        UsageStatus.cancelled,
        streamedUsage,
      );
      completionPersisted = true;
    };

    try {
      completionModel = await resolveCompletionModel(
        input.userId,
        requestedModel,
        metadata.reasoning,
      );
      streamedModel = completionModel;

      if (input.cancellation.isCancelled()) {
        await persistCancelledCompletion(Date.now() - startedAt);
        return;
      }

      const apiKey = await apiKeyService.getActiveOpenRouterApiKeyForUser(input.userId);

      input.cancellation.throwIfCancelled();

      await input.callbacks.onStart({ messageId: assistantMessageId });

      const completion = await openRouterStreamingService.createStreamingChatCompletion(
        {
          apiKey,
          model: completionModel,
          messages: openRouterMessages,
          ...(metadata.reasoning ? { reasoning: getReasoningConfig() } : {}),
          ...(metadata.webSearch ? { plugins: [{ id: 'web' as const }] } : {}),
          userId: input.userId,
        },
        {
          onToken: async (content) => {
            if (input.cancellation.isCancelled()) {
              return;
            }

            streamedContent += content;
            await input.callbacks.onToken({ content });
          },
          onModel: (model) => {
            streamedModel = model;
          },
        },
        input.cancellation.signal,
      );
      const usage = toTokenUsage(completion.usage, completion.latencyMs);
      streamedUsage = usage;

      if (completion.cancelled || input.cancellation.isCancelled()) {
        streamedModel = completion.model;
        streamedContent = completion.content;
        await persistCancelledCompletion(completion.latencyMs);
        return;
      }

      const status = usage ? UsageStatus.success : UsageStatus.partial;

      await persistCompletion({
        userId: input.userId,
        chatId: input.chatId,
        messageId: assistantMessageId,
        model: completion.model,
        content: completion.content,
        metadata,
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

      if (input.cancellation.isCancelled() || isStreamCancelledError(error)) {
        await persistCancelledCompletion(latencyMs);
        return;
      }

      if (streamedContent.length > 0) {
        await persistCompletion({
          userId: input.userId,
          chatId: input.chatId,
          messageId: assistantMessageId,
          model: streamedModel,
          content: streamedContent,
          metadata,
          latencyMs,
          status: UsageStatus.partial,
        });
      } else {
        await safePersistFailure(input.userId, input.chatId, completionModel, latencyMs);
      }

      throw error;
    }
  },
};