import { Router } from "express";
import {
  leaderboard,
  removeAttempt,
} from "../../controllers/adminQuizController.js";

const router = Router();
router.get("/leaderboard", leaderboard);
router.delete("/attempts/:attemptId", removeAttempt);
export default router;
