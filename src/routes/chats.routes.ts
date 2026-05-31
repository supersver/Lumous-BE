import { Router } from 'express';
import { chatsController } from '@controllers/chats.controller';
import { requireAuth } from '@middlewares/auth.middleware';

const router = Router();

router.get('/', requireAuth, chatsController.list);

export default router;
