import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  deleteCallHistory,
  endCallHistory,
  getCallHistory,
  startCallHistory,
} from "../controllers/callHistory.controller.js";

const router = express.Router();
router.use(protectRoute);
router.get("/", getCallHistory);
router.post("/start", startCallHistory);
router.patch("/:roomId/end", endCallHistory);
router.delete("/:id", deleteCallHistory);

export default router;
