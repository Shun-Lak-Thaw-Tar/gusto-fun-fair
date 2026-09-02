import { Router } from 'express'; import { submitPayment } from '../controllers/paymentController.js'; import { requireAuth } from '../middleware/authMiddleware.js';
const router = Router(); router.post('/orders/:orderId', requireAuth, submitPayment); export default router;
