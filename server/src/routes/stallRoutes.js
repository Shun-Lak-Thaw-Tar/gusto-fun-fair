import { Router } from 'express'; import { getStall, getStallBySlug, getStallImage, listStalls } from '../controllers/stallController.js';
const router = Router(); router.get('/', listStalls); router.get('/by-slug/:slug', getStallBySlug); router.get('/:id', getStall); router.get('/:id/image', getStallImage); export default router;
