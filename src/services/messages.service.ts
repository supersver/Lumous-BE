import { MessageRole, Prisma, UsageStatus, type Message } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { AppError } from '@middlewares/error.middleware';
import { apiKeyService } from '@services/api-key.service';
import { openRouterChatService } from '@services/openrouter.chat.service';
import type {
  ChatCompletionResponseDto,
  ChatMessageDto,
  CreateChatMessageDto,
  TokenUsageDto,
} from '@/types/message.dto';
import type {
  OpenRouterChatCompletionDto,
  OpenRouterChatMessageDto,
  OpenRouterChatRole,
} from '@/types/openrouter-chat.dto';

const openRouterProvider = 'openrouter';

type CreateMessageForChatInput = {
  userId: string;
  chatId: string;
  dto: CreateChatMessageDto;
};

const toChatMessageDto = (message: Message): ChatMessageDto => ({
  id: message.id,
  chatId: message.chatId,
  role: message.role,
  content: message.content,
  promptTokens: message.promptTokens,
  completionTokens: message.completionTokens,
  totalTokens: message.totalTokens,
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

    await prisma.message.create({
      data: {
        chatId: input.chatId,
        role: MessageRole.user,
        content: input.dto.content,
      },
    });

    const history = await prisma.message.findMany({
      where: { chatId: input.chatId },
      orderBy: { createdAt: 'asc' },
    });

    const openRouterMessages = history.map(toOpenRouterMessage);
    const startedAt = Date.now();

    try {
      const apiKey = await apiKeyService.getActiveOpenRouterApiKeyForUser(input.userId);
      const completion = await openRouterChatService.createChatCompletion({
        apiKey,
        model: input.dto.model,
        messages: openRouterMessages,
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
        message: toChatMessageDto(assistantMessage),
        ...(usage ? { usage } : {}),
      };
    } catch (error) {
      await writeFailedUsageLog(
        input.userId,
        input.chatId,
        input.dto.model,
        Date.now() - startedAt,
      );
      throw error;
    }
  },
};
