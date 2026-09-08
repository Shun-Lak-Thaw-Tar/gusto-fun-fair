import { Router } from "express";

import {
  createCrushLetter,
  listCrushLetters,
} from "../controllers/crushLetterController.js";
import { crushLetterSubmissionLimiter } from "../middleware/crushLetterRateLimit.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/", listCrushLetters);

router.post("/", requireAuth, crushLetterSubmissionLimiter, createCrushLetter);

export default router;
