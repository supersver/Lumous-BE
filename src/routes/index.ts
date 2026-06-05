import { Router } from 'express';
import analyticsRoutes from '@routes/analytics.routes';
import apiKeyRoutes from '@routes/api-key.routes';
import authRoutes from '@routes/auth.routes';
import chatsRoutes from '@routes/chats.routes';
import healthRoutes from '@routes/health.routes';
import modelsRoutes from '@routes/models.routes';
import usageRoutes from '@routes/usage.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/chats', chatsRoutes);
router.use('/usage', usageRoutes);
router.use('/api-keys', apiKeyRoutes);
router.use('/models', modelsRoutes);

export default router;
