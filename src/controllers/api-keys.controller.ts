import { AppError } from '@middlewares/error.middleware';
import { asyncHandler } from '@middlewares/async-handler.middleware';
import type { Request, Response } from 'express';

export const apiKeysController = {
  list: asyncHandler((req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError('Authentication required.', 401, 'AUTH_REQUIRED');
    }

    res.status(200).json({
      message: 'Protected API keys route.',
      user: req.user,
      apiKeys: [],
    });
  }),
};
