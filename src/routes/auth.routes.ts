import { Router } from 'express';
import { authController } from '@controllers/auth.controller';
import { authenticateFirebase } from '@middlewares/auth.middleware';

const router = Router();

router.get('/me', authenticateFirebase, authController.getMe);

export default router;
