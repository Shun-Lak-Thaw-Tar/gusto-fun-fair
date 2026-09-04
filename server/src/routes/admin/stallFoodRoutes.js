import { Router } from 'express';
import { createStallFood, getStallFood, listStallFoods, updateStallFood } from '../../controllers/admin/adminStallFoodController.js';
const router = Router();
router.route('/').get(listStallFoods).post(createStallFood);
router.route('/:id').get(getStallFood).patch(updateStallFood);
export default router;
