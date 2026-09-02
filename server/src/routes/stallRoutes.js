import { Router } from 'express'; import { getStall, listStalls } from '../controllers/stallController.js';
const router = Router(); router.get('/', listStalls); router.get('/:id', getStall); export default router;
