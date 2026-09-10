import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import {
  beginQuiz,
  leaderboard,
  result,
  submit,
  validateCode,
} from "../controllers/quizController.js";
import { quizRateLimiter } from "../middleware/eventRateLimit.js";

const router = Router();
router.get("/leaderboard", leaderboard);
router.use(requireAuth, quizRateLimiter);
router.post("/validate-code", validateCode);
router.post("/start", beginQuiz);
router.post("/:attemptId/submit", submit);
router.get("/result/:attemptId", result);
export default router;
