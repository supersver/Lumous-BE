import { Router } from 'express';
import apiKeysRoutes from '@routes/api-keys.routes';
import authRoutes from '@routes/auth.routes';
import chatsRoutes from '@routes/chats.routes';
import healthRoutes from '@routes/health.routes';
import usageRoutes from '@routes/usage.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/chats', chatsRoutes);
router.use('/usage', usageRoutes);
router.use('/api-keys', apiKeysRoutes);

export default router;
