import { Router } from 'express';
import { usageController } from '@controllers/usage.controller';
import { requireAuth } from '@middlewares/auth.middleware';

const router = Router();

router.get('/', requireAuth, usageController.getSummary);

export default router;
