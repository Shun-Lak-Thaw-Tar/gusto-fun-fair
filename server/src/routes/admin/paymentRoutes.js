import { Router } from 'express';
import { listSubmittedPayments, reviewSubmittedPayment } from '../../controllers/admin/adminPaymentController.js';

const router = Router();
router.get('/', listSubmittedPayments);
router.patch('/:id/review', reviewSubmittedPayment);
export default router;
