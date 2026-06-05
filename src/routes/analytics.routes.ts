import { Router } from 'express';
import { analyticsController } from '@controllers/analytics.controller';
import { requireAuth } from '@middlewares/auth.middleware';

const router = Router();

router.get('/overview', requireAuth, analyticsController.overview);
router.get('/usage-by-day', requireAuth, analyticsController.usageByDay);
router.get('/models', requireAuth, analyticsController.models);
router.get('/chats', requireAuth, analyticsController.chats);

export default router;
