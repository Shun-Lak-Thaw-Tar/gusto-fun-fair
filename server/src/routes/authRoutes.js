import { Router } from 'express';
import { login, me, register } from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { authLimiters } from '../middleware/authRateLimit.js';
const router = Router();
router.post('/register', authLimiters.sharedIp, authLimiters.signupIp, authLimiters.register, register); router.post('/login', authLimiters.sharedIp, authLimiters.login, login); router.get('/me', requireAuth, me);
export default router;
