import { Router } from 'express';
import { createMemory, listMemories, getMemoryImage, deleteMyMemory, getSnapWindow, getMySnapAllowance, getMyMemories, reactToMemory, getMyReaction } from '../controllers/memoryController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { receiveImage } from '../middleware/uploadMiddleware.js';

const router = Router();
router.get('/', listMemories);
router.get('/window', getSnapWindow);
router.get('/mine', requireAuth, getMyMemories);
router.get('/allowance', requireAuth, getMySnapAllowance);
router.post('/', requireAuth, receiveImage, createMemory);
router.get('/:id/image', getMemoryImage);
router.delete('/:id', requireAuth, deleteMyMemory);
router.get('/:id/reaction', requireAuth, getMyReaction);
router.put('/:id/reaction', requireAuth, reactToMemory);
export default router;
