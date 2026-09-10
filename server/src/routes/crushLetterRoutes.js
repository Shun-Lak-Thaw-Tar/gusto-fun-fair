import { Router } from "express";

import {
  createCrushLetter,
  getCrushLetterAllowance,
  listCrushLetters,
} from "../controllers/crushLetterController.js";
import { crushLetterSubmissionLimiter } from "../middleware/crushLetterRateLimit.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { markCrushLetterBoothTest } from "../middleware/crushLetterBoothTestMiddleware.js";

const router = Router();

router.get("/", listCrushLetters);

router.get("/allowance", requireAuth, getCrushLetterAllowance);

router.post(
  "/",
  requireAuth,
  markCrushLetterBoothTest,
  crushLetterSubmissionLimiter,
  createCrushLetter,
);

export default router;
