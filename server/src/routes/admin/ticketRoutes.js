import { Router } from 'express';
import { lookupTicket, redeemTicket } from '../../controllers/ticketController.js';
const router = Router();
router.get('/:code', lookupTicket);
router.post('/:code/redeem', redeemTicket);
export default router;
