import { Router } from 'express';
import { getSnapWindow, updateSnapWindow, removeMemory } from '../../controllers/memoryController.js';

const router = Router();
router.get('/window', getSnapWindow);
router.put('/window', updateSnapWindow);
router.delete('/:id', removeMemory);
export default router;
