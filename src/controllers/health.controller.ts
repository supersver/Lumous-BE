import { healthService } from '@services/health.service';
import { asyncHandler } from '@middlewares/async-handler.middleware';

export const healthController = {
  check: asyncHandler(async (_req, res) => {
    const health = await healthService.getHealth();
    res.status(health.database === 'connected' ? 200 : 503).json(health);
  }),
};
