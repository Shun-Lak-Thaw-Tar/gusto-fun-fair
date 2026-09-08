import { Router } from "express";
import {
  getSnapWindow,
  updateSnapWindow,
  removeMemory,
  listAdminMemories,
  reviewMemory,
  getAdminMemoryImage,
} from "../../controllers/memoryController.js";

const router = Router();
router.get("/window", getSnapWindow);
router.put("/window", updateSnapWindow);
router.get("/", listAdminMemories);
router.get("/:id/image", getAdminMemoryImage);
router.patch("/:id/review", reviewMemory);
router.delete("/:id", removeMemory);
export default router;
