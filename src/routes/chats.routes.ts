import { Router } from 'express';
import { chatsController } from '@controllers/chats.controller';
import { messagesController } from '@controllers/messages.controller';
import { requireAuth } from '@middlewares/auth.middleware';

const router = Router();

router.get('/', requireAuth, chatsController.list);
router.post('/:chatId/messages', requireAuth, messagesController.create);

export default router;
