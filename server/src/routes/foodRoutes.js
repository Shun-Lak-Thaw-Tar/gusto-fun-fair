import { Router } from 'express'; import { getFood, getFoodImage, listFoods } from '../controllers/foodController.js';
const router = Router(); router.get('/', listFoods); router.get('/:id', getFood); router.get('/:id/image', getFoodImage); export default router;
