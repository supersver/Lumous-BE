import { Router } from 'express';
import { chatsController } from '@controllers/chats.controller';
import { messagesController } from '@controllers/messages.controller';
import { streamingController } from '@controllers/streaming.controller';
import { requireAuth } from '@middlewares/auth.middleware';

const router = Router();

router.post('/', requireAuth, chatsController.create);
router.get('/', requireAuth, chatsController.list);
router.get('/:chatId', requireAuth, chatsController.getById);
router.delete('/:chatId', requireAuth, chatsController.remove);
router.post('/:chatId/messages', requireAuth, messagesController.create);
router.post('/:chatId/messages/stream', requireAuth, streamingController.create);

export default router;
