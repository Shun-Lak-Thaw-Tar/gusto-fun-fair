import { Router } from 'express';
import { getDashboard } from '../../controllers/admin/adminDashboardController.js';

const router = Router();

router.get('/', getDashboard);

export default router;