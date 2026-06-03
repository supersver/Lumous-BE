import type { Chat, Message } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { AppError } from '@middlewares/error.middleware';
import type {
  ChatDetailMessageDto,
  ChatDetailsDto,
  ChatResponseDto,
  ChatSummaryDto,
  CreateChatDto,
  ListChatsQueryDto,
} from '@/types/chats.dto';

const defaultChatTitle = 'New Chat';
const openRouterProvider = 'openrouter';

type ChatWithMessages = Chat & {
  messages: Message[];
};

const toChatResponseDto = (chat: Chat): ChatResponseDto => ({
  id: chat.id,
  title: chat.title,
  model: chat.model,
  createdAt: chat.createdAt,
  updatedAt: chat.updatedAt,
});

const toChatSummaryDto = (chat: Chat): ChatSummaryDto => ({
  id: chat.id,
  title: chat.title,
  model: chat.model,
  updatedAt: chat.updatedAt,
});

const toChatDetailMessageDto = (message: Message): ChatDetailMessageDto => ({
  id: message.id,
  chatId: message.chatId,
  role: message.role,
  content: message.content,
  promptTokens: message.promptTokens,
  completionTokens: message.completionTokens,
  totalTokens: message.totalTokens,
  createdAt: message.createdAt,
});

const toChatDetailsDto = (chat: ChatWithMessages): ChatDetailsDto => ({
  ...toChatResponseDto(chat),
  messages: chat.messages.map(toChatDetailMessageDto),
});

export const chatsService = {
  async createForUser(userId: string, dto: CreateChatDto): Promise<ChatResponseDto> {
    const chat = await prisma.chat.create({
      data: {
        userId,
        title: defaultChatTitle,
        model: dto.model,
        provider: openRouterProvider,
      },
    });

    return toChatResponseDto(chat);
  },

  async listForUser(userId: string, query: ListChatsQueryDto): Promise<ChatSummaryDto[]> {
    const chats = await prisma.chat.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      skip: query.offset,
      take: query.limit,
    });

    return chats.map(toChatSummaryDto);
  },

  async getForUser(userId: string, chatId: string): Promise<ChatDetailsDto> {
    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        userId,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!chat) {
      throw new AppError('Chat not found.', 404, 'CHAT_NOT_FOUND');
    }

    return toChatDetailsDto(chat);
  },

  async deleteForUser(userId: string, chatId: string): Promise<void> {
    const result = await prisma.chat.deleteMany({
      where: {
        id: chatId,
        userId,
      },
    });

    if (result.count === 0) {
      throw new AppError('Chat not found.', 404, 'CHAT_NOT_FOUND');
    }
  },
};
