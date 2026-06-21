import { MessageRole, Prisma, UsageStatus, type Message } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { AppError } from '@middlewares/error.middleware';
import { apiKeyService } from '@services/api-key.service';
import { openRouterChatService } from '@services/openrouter.chat.service';
import { openRouterService } from '@services/openrouter.service';
import { generateChatTitle } from '@utils/generate-chat-title';
import type {
  ChatCompletionResponseDto,
  ChatMessageDto,
  CreateChatMessageDto,
  MessageMetadataDto,
  TokenUsageDto,
} from '@/types/message.dto';
import type {
  OpenRouterChatCompletionDto,
  OpenRouterChatMessageDto,
  OpenRouterChatRole,
  OpenRouterReasoningConfigDto,
} from '@/types/openrouter-chat.dto';

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

type CreateMessageForChatInput = {
  userId: string;
  chatId: string;
  dto: CreateChatMessageDto;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const createMessageMetadata = (dto: CreateChatMessageDto): MessageMetadataDto => ({
  reasoning: dto.reasoning,
  webSearch: dto.webSearch,
});

const toPrismaMetadata = (metadata: MessageMetadataDto): Prisma.InputJsonObject => ({
  reasoning: metadata.reasoning,
  webSearch: metadata.webSearch,
});

const parseMessageMetadata = (metadata: Prisma.JsonValue | null): MessageMetadataDto | null => {
  if (!isRecord(metadata)) {
    return null;
  }

  return {
    reasoning: metadata.reasoning === true,
    webSearch: metadata.webSearch === true,
  };
};

const toChatMessageDto = (message: Message): ChatMessageDto => ({
  id: message.id,
  chatId: message.chatId,
  role: message.role,
  content: message.content,
  promptTokens: message.promptTokens,
  completionTokens: message.completionTokens,
  totalTokens: message.totalTokens,
  metadata: parseMessageMetadata(message.metadata),
  createdAt: message.createdAt,
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

const getCompletionUsage = (completion: OpenRouterChatCompletionDto): TokenUsageDto | undefined => {
  if (!completion.usage) {
    return undefined;
  }

  return {
    promptTokens: completion.usage.promptTokens,
    completionTokens: completion.usage.completionTokens,
    totalTokens: completion.usage.totalTokens,
    latencyMs: completion.latencyMs,
    ...(completion.usage.estimatedCost ? { estimatedCost: completion.usage.estimatedCost } : {}),
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

const writeFailedUsageLog = async (
  userId: string,
  chatId: string,
  model: string,
  latencyMs: number,
): Promise<void> => {
  try {
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
  } catch (error) {
    console.error('Failed to write usage log for chat completion failure.', error);
  }
};

export const messagesService = {
  async createForChat(input: CreateMessageForChatInput): Promise<ChatCompletionResponseDto> {
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
    const startedAt = Date.now();
    let completionModel = requestedModel;

    try {
      completionModel = await resolveCompletionModel(
        input.userId,
        requestedModel,
        metadata.reasoning,
      );
      const apiKey = await apiKeyService.getActiveOpenRouterApiKeyForUser(input.userId);
      const completion = await openRouterChatService.createChatCompletion({
        apiKey,
        model: completionModel,
        messages: openRouterMessages,
        ...(metadata.reasoning ? { reasoning: getReasoningConfig() } : {}),
        ...(metadata.webSearch ? { plugins: [{ id: 'web' as const }] } : {}),
        userId: input.userId,
      });
      const usage = getCompletionUsage(completion);
      const usageNumbers = getUsageNumbers(usage);
      const usageStatus = usage ? UsageStatus.success : UsageStatus.partial;

      const [assistantMessage] = await prisma.$transaction([
        prisma.message.create({
          data: {
            chatId: input.chatId,
            role: MessageRole.assistant,
            content: completion.content,
            metadata: toPrismaMetadata(metadata),
            promptTokens: usage?.promptTokens ?? null,
            completionTokens: usage?.completionTokens ?? null,
            totalTokens: usage?.totalTokens ?? null,
          },
        }),
        prisma.usageLog.create({
          data: {
            userId: input.userId,
            chatId: input.chatId,
            provider: openRouterProvider,
            model: completion.model,
            promptTokens: usageNumbers.promptTokens,
            completionTokens: usageNumbers.completionTokens,
            totalTokens: usageNumbers.totalTokens,
            estimatedCost: usageNumbers.estimatedCost,
            latencyMs: completion.latencyMs,
            status: usageStatus,
          },
        }),
        prisma.chat.update({
          where: { id: input.chatId },
          data: {
            model: completion.model,
            provider: openRouterProvider,
          },
        }),
      ]);

      return {
        assistantMessage: toChatMessageDto(assistantMessage),
        metadata: { reasoning: metadata.reasoning },
        ...(usage ? { usage } : {}),
      };
    } catch (error) {
      await writeFailedUsageLog(
        input.userId,
        input.chatId,
        completionModel,
        Date.now() - startedAt,
      );
      throw error;
    }
  },
};