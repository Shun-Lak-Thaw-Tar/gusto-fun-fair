import { Router } from 'express'; import { createMemory, listMemories } from '../controllers/memoryController.js'; import { requireAuth } from '../middleware/authMiddleware.js';
const router = Router(); router.get('/', listMemories); router.post('/', requireAuth, createMemory); export default router;
