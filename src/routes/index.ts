import { Router } from 'express';
import authRoutes from '@routes/auth.routes';
import healthRoutes from '@routes/health.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);

export default router;
