import { Router } from 'express';
import { apiKeysController } from '@controllers/api-keys.controller';
import { requireAuth } from '@middlewares/auth.middleware';

const router = Router();

router.get('/', requireAuth, apiKeysController.list);

export default router;
