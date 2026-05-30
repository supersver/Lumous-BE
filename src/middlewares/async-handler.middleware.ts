import type { NextFunction, Request, RequestHandler, Response } from 'express';

type RouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<void> | void;

export const asyncHandler =
  (handler: RouteHandler): RequestHandler =>
  (req, res, next) => {
    void Promise.resolve(handler(req, res, next)).catch(next);
  };
