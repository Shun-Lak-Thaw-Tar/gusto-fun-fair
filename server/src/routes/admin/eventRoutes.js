import { Router } from 'express';
import { getEvent, updateEvent } from '../../controllers/admin/adminEventController.js';
const router = Router();
router.route('/').get(getEvent).patch(updateEvent);
export default router;
