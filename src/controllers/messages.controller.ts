import { AppError } from '@middlewares/error.middleware';
import { asyncHandler } from '@middlewares/async-handler.middleware';
import { messagesService } from '@services/messages.service';
import { parseChatIdParam, parseCreateChatMessageDto } from '@/types/message.dto';
import type { Request, Response } from 'express';

const getAuthenticatedUserId = (req: Request): string => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401, 'AUTH_REQUIRED');
  }

  return req.user.id;
};

export const messagesController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    const chatId = parseChatIdParam(req.params.chatId);
    const dto = parseCreateChatMessageDto(req.body);
    const result = await messagesService.createForChat({ userId, chatId, dto });

    res.status(201).json(result);
  }),
};
