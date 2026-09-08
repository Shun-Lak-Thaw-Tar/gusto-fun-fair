import { Router } from 'express';
import { submitPayment, getMyPayment, getPaymentProof } from '../controllers/paymentController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { receiveImage } from '../middleware/uploadMiddleware.js';

const router = Router();
router.use(requireAuth);
router.get('/orders/:orderId', getMyPayment);
router.post('/orders/:orderId', receiveImage, submitPayment);
router.get('/:id/proofs/:version', getPaymentProof);
export default router;
