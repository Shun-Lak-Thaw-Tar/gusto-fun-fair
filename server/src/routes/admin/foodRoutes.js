import { Router } from 'express';
import { createFood, getFood, listFoods, updateFood } from '../../controllers/admin/adminFoodController.js';
import { receiveOptionalImage } from '../../middleware/uploadMiddleware.js';
const router = Router();
router.route('/').get(listFoods).post(receiveOptionalImage, createFood);
router.route('/:id').get(getFood).patch(receiveOptionalImage, updateFood);
export default router;
