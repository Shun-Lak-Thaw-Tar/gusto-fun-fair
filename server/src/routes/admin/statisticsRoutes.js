import { Router } from 'express';
import { bestSellingStall, salesByFood, salesByStall, statisticsOverview } from '../../controllers/admin/adminStatisticsController.js';

const router = Router();
router.get('/overview', statisticsOverview);
router.get('/stalls', salesByStall);
router.get('/foods', salesByFood);
router.get('/best-selling-stall', bestSellingStall);
export default router;
