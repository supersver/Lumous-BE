import { healthService } from '@services/health.service';
import { asyncHandler } from '@middlewares/async-handler.middleware';

export const healthController = {
  check: asyncHandler((_req, res) => {
    res.status(200).json(healthService.getHealth());
  }),
};
