import { AppError } from '@middlewares/error.middleware';
import { asyncHandler } from '@middlewares/async-handler.middleware';
import { apiKeyService } from '@services/api-key.service';
import { parseApiKeyIdParam, parseCreateApiKeyDto } from '@/types/api-key.dto';
import type { Request, Response } from 'express';

const getAuthenticatedUserId = (req: Request): string => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401, 'AUTH_REQUIRED');
  }

  return req.user.id;
};

export const apiKeyController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    const dto = parseCreateApiKeyDto(req.body);
    const apiKey = await apiKeyService.createForUser(userId, dto);

    res.status(201).json({ apiKey });
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    const apiKeys = await apiKeyService.listForUser(userId);

    res.status(200).json({ apiKeys });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    const apiKeyId = parseApiKeyIdParam(req.params.id);

    await apiKeyService.deleteForUser(userId, apiKeyId);

    res.status(204).send();
  }),
};
