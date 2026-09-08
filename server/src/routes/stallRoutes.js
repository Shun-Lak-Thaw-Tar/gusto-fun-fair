import { Router } from 'express'; import { getStall, getStallBySlug, listStalls } from '../controllers/stallController.js';
const router = Router(); router.get('/', listStalls); router.get('/by-slug/:slug', getStallBySlug); router.get('/:id', getStall); export default router;
