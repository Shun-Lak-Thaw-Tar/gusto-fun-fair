import { Router } from "express";
import {
  createMemory,
  listMemories,
  getMemoryImage,
  deleteMyMemory,
  getSnapWindow,
  getMySnapAllowance,
  getMyMemories,
  reactToMemory,
  getMyReaction,
} from "../controllers/memoryController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { receiveImage } from "../middleware/uploadMiddleware.js";
import {
  memoryReactionLimiter,
  memoryUploadLimiter,
} from "../middleware/eventRateLimit.js";
import { markMemoryBoothTest } from "../middleware/memoryBoothTestMiddleware.js";

const router = Router();
router.get("/", listMemories);
router.get("/window", markMemoryBoothTest, getSnapWindow);
router.get("/mine", requireAuth, getMyMemories);
router.get("/allowance", requireAuth, markMemoryBoothTest, getMySnapAllowance);
router.post(
  "/",
  requireAuth,
  markMemoryBoothTest,
  memoryUploadLimiter,
  receiveImage,
  createMemory,
);
router.get("/:id/image", getMemoryImage);
router.delete("/:id", requireAuth, deleteMyMemory);
router.get("/:id/reaction", requireAuth, getMyReaction);
router.put(
  "/:id/reaction",
  requireAuth,
  markMemoryBoothTest,
  memoryReactionLimiter,
  reactToMemory,
);
export default router;
