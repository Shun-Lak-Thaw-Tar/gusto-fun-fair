import { Router } from 'express'; import { createOrder, getMyOrder, listMyOrders } from '../controllers/orderController.js'; import { requireAuth } from '../middleware/authMiddleware.js';
const router = Router(); router.use(requireAuth); router.route('/').get(listMyOrders).post(createOrder); router.get('/:id', getMyOrder); export default router;
