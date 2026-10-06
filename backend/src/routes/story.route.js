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
  getHiddenStoryUsers,
  hideStoriesFromUser,
  unhideStoriesFromUser,
  reportStory,
} from "../controllers/story.controller.js";

const router = express.Router();

router.use(protectRoute);

router.get("/hidden-users", getHiddenStoryUsers);
router.post("/hide/:userId", hideStoriesFromUser);
router.delete("/hide/:userId", unhideStoriesFromUser);
router.get("/", getStories);
router.post("/", createStory);
router.post("/:id/view", viewStory);
router.get("/:id/viewers", getStoryViewers);
router.post("/:id/reaction", addReaction);
router.delete("/:id/reaction", removeReaction);
router.post("/:id/report", reportStory);
router.delete("/:id", deleteStory);

export default router;
