import { Router } from 'express';
import { apiKeyController } from '@controllers/api-key.controller';
import { requireAuth } from '@middlewares/auth.middleware';

const router = Router();

router.post('/', requireAuth, apiKeyController.create);
router.get('/', requireAuth, apiKeyController.list);
router.delete('/:id', requireAuth, apiKeyController.remove);

export default router;
