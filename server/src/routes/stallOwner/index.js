import { Router } from 'express';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { requireStallOwner } from '../../middleware/stallOwnerMiddleware.js';
import { getDashboard, getMyFoods, getMySales, getMyStall, getShareData } from '../../controllers/stallOwner/stallOwnerController.js';

const router = Router();
router.use(requireAuth, requireStallOwner);
router.get('/dashboard', getDashboard);
router.get('/stall', getMyStall);
router.get('/foods', getMyFoods);
router.get('/sales', getMySales);
router.get('/share', getShareData);
export default router;
