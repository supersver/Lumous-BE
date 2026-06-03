import { AppError } from '@middlewares/error.middleware';
import { asyncHandler } from '@middlewares/async-handler.middleware';
import { chatsService } from '@services/chats.service';
import {
  parseChatIdParam,
  parseCreateChatDto,
  parseListChatsQueryDto,
} from '@/types/chats.dto';
import type { Request, Response } from 'express';

const getAuthenticatedUserId = (req: Request): string => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401, 'AUTH_REQUIRED');
  }

  return req.user.id;
};

export const chatsController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    const dto = parseCreateChatDto(req.body);
    const chat = await chatsService.createForUser(userId, dto);

    res.status(201).json(chat);
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    const query = parseListChatsQueryDto(req.query);
    const chats = await chatsService.listForUser(userId, query);

    res.status(200).json(chats);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    const chatId = parseChatIdParam(req.params.chatId);
    const chat = await chatsService.getForUser(userId, chatId);

    res.status(200).json(chat);
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    const chatId = parseChatIdParam(req.params.chatId);

    await chatsService.deleteForUser(userId, chatId);

    res.status(204).send();
  }),
};
