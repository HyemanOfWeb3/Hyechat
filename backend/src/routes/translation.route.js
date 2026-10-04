import express from "express";
import rateLimit from "express-rate-limit";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  getTranslationLanguages,
  translateTextRequest,
  transcribeVoiceRequest,
} from "../controllers/translation.controller.js";

const router = express.Router();
const translationLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user._id),
  handler: (_req, res) =>
    res.status(429).json({
      code: "RATE_LIMITED",
      message: "Translation is busy right now. Please wait a moment.",
    }),
});

router.use(protectRoute);
router.get("/languages", translationLimiter, getTranslationLanguages);
router.post("/text", translationLimiter, translateTextRequest);
router.post("/voice/transcribe", translationLimiter, transcribeVoiceRequest);

export default router;