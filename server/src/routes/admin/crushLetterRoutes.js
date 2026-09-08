import { Router } from 'express';
import { getCrushLetter, listCrushLetters, reviewCrushLetter, updateCrushLetterVisibility } from '../../controllers/admin/adminCrushLetterController.js';

const router = Router();
router.get('/', listCrushLetters);
router.get('/:id', getCrushLetter);
router.patch('/:id/review', reviewCrushLetter);
router.patch('/:id/visibility', updateCrushLetterVisibility);
export default router;
