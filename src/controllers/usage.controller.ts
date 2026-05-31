import { AppError } from '@middlewares/error.middleware';
import { asyncHandler } from '@middlewares/async-handler.middleware';
import type { Request, Response } from 'express';

export const usageController = {
  getSummary: asyncHandler((req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError('Authentication required.', 401, 'AUTH_REQUIRED');
    }

    res.status(200).json({
      message: 'Protected usage route.',
      user: req.user,
      usage: null,
    });
  }),
};
