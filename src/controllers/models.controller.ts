import { AppError } from '@middlewares/error.middleware';
import { asyncHandler } from '@middlewares/async-handler.middleware';
import { openRouterService } from '@services/openrouter.service';
import type { Request, Response } from 'express';

const getAuthenticatedUserId = (req: Request): string => {
  if (!req.user) throw new AppError('Authentication required.', 401, 'AUTH_REQUIRED');
  return req.user.id;
};

export const modelsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    const response = await openRouterService.listModelsForUser(userId);
    res.status(200).json(response);
  }),
};
