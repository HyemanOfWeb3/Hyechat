import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  createStory,
  deleteStory,
  getStories,
  viewStory,
  getStoryViewers,
  addReaction,
  removeReaction,
} from "../controllers/story.controller.js";

const router = express.Router();

router.use(protectRoute);

router.get("/", getStories);
router.post("/", createStory);
router.post("/:id/view", viewStory);
router.get("/:id/viewers", getStoryViewers);
router.post("/:id/reaction", addReaction);
router.delete("/:id/reaction", removeReaction);
router.delete("/:id", deleteStory);

export default router;
