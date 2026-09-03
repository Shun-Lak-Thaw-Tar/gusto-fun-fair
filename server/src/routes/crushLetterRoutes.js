import { Router } from 'express';

import {
  createCrushLetter,
  listCrushLetters,
} from '../controllers/crushLetterController.js';

const router = Router();

router.get('/', listCrushLetters);

router.post('/', createCrushLetter);

export default router;