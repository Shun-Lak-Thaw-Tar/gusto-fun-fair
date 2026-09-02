import { Router } from 'express';
import { bestSellingStall } from '../../controllers/admin/adminStatisticsController.js';

const router = Router();
router.get('/best-selling-stall', bestSellingStall);
export default router;
