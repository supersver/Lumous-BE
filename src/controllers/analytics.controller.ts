import { AppError } from '@middlewares/error.middleware';
import { asyncHandler } from '@middlewares/async-handler.middleware';
import { analyticsService } from '@services/analytics.service';
import {
  parseAnalyticsDateRangeQueryDto,
  parseAnalyticsPaginatedQueryDto,
} from '@/types/analytics.dto';
import type { Request, Response } from 'express';

const getAuthenticatedUserId = (req: Request): string => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401, 'AUTH_REQUIRED');
  }

  return req.user.id;
};

export const analyticsController = {
  overview: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    const query = parseAnalyticsDateRangeQueryDto(req.query);
    const overview = await analyticsService.getOverview(userId, query);

    res.status(200).json(overview);
  }),

  usageByDay: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    const query = parseAnalyticsDateRangeQueryDto(req.query);
    const usage = await analyticsService.getUsageByDay(userId, query);

    res.status(200).json(usage);
  }),

  models: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    const query = parseAnalyticsPaginatedQueryDto(req.query);
    const models = await analyticsService.getModels(userId, query);

    res.status(200).json(models);
  }),

  chats: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    const query = parseAnalyticsPaginatedQueryDto(req.query);
    const chats = await analyticsService.getChats(userId, query);

    res.status(200).json(chats);
  }),
};
