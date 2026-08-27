import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  getStreamToken,
  syncStreamUsers,
} from "../controllers/chat.controller.js";
//import { generateStreamToken } from "../lib/stream.js";

const router = express.Router();

router.get("/token", protectRoute, getStreamToken);
router.post("/users/sync", protectRoute, syncStreamUsers);

export default router;
