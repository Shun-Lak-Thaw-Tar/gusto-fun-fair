import { Router } from 'express';

import {
  createCrushLetter,
  listCrushLetters,
} from '../controllers/crushLetterController.js';
import { crushLetterSubmissionLimiter } from '../middleware/crushLetterRateLimit.js';

const router = Router();

router.get('/', listCrushLetters);

router.post('/', crushLetterSubmissionLimiter, createCrushLetter);

export default router;
