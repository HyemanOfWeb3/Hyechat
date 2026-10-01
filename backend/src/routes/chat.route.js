import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  getStreamToken,
  syncStreamUsers,
  translateChatMessage,
} from "../controllers/chat.controller.js";
//import { generateStreamToken } from "../lib/stream.js";

const router = express.Router();

router.get("/token", protectRoute, getStreamToken);
router.post("/users/sync", protectRoute, syncStreamUsers);
router.post(
  "/messages/:messageId/translate",
  protectRoute,
  translateChatMessage,
);

export default router;
