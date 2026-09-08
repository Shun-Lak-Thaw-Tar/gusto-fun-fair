import { Router } from 'express';
import { createStall, createStallOwner, getStall, getStallOwner, listStalls, resetStallOwnerPassword, updateStall, updateStallOwnerStatus, updateStallStatus } from '../../controllers/admin/adminStallController.js';

const router = Router();
router.route('/').get(listStalls).post(createStall);
router.get('/:stallId/owner', getStallOwner);
router.post('/:stallId/owner', createStallOwner);
router.patch('/:stallId/owner/password', resetStallOwnerPassword);
router.patch('/:stallId/owner/status', updateStallOwnerStatus);
router.patch('/:id/status', updateStallStatus);
router.route('/:id').get(getStall).patch(updateStall);
export default router;
