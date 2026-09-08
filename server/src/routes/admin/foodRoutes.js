import { Router } from 'express';
import { createFood, getFood, listFoods, updateFood } from '../../controllers/admin/adminFoodController.js';
const router = Router();
router.route('/').get(listFoods).post(createFood);
router.route('/:id').get(getFood).patch(updateFood);
export default router;
