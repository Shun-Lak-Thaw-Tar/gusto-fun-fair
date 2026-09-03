import { Router } from 'express';
import { getOrder, listOrders } from '../../controllers/admin/adminOrderController.js';
const router = Router();
router.get('/', listOrders);
router.get('/:id', getOrder);
export default router;
