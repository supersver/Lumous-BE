import { authService } from '@services/auth.service';
import { asyncHandler } from '@middlewares/async-handler.middleware';
import type { AuthenticatedRequest } from '@/types/auth';
import type { Request, Response } from 'express';

export const authController = {
  getMe: asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.getOrCreateUser((req as AuthenticatedRequest).user);
    res.status(200).json({ user });
  }),
};
