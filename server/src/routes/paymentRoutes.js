import { Router } from 'express';
import { submitPayment, preparePaymentUpload, getMyPayment, getPaymentProof } from '../controllers/paymentController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { createProofUploadHandler, proofUploadRateLimiters } from '../middleware/proofUploadMiddleware.js';

const router = Router();
router.use(requireAuth);
router.get('/orders/:orderId', getMyPayment);
router.post('/orders/:orderId', ...proofUploadRateLimiters, createProofUploadHandler({ prepare: preparePaymentUpload, submit: submitPayment }));
router.get('/:id/proofs/:version', getPaymentProof);
export default router;
