import { Router } from 'express';
import { modelsController } from '@controllers/models.controller';
import { requireAuth } from '@middlewares/auth.middleware';

const router = Router();

router.get('/', requireAuth, modelsController.list);

export default router;
