import express from "express";
import rateLimit from "express-rate-limit";
import {
  forgotPassword,
  login,
  logout,
  onboard,
  resendVerificationOTP,
  resetPassword,
  sendVerificationOTP,
  signup,
  verifyEmailOTP,
} from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();
const passwordResetMessage =
  "If an account with that email exists, a password reset link has been sent.";
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ message: passwordResetMessage });
  },
});
const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});
const createAuthAttemptLimiter = (limit) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
  });
const signupLimiter = createAuthAttemptLimiter(5);
const loginLimiter = createAuthAttemptLimiter(10);
const resetPasswordLimiter = createAuthAttemptLimiter(10);

router.post("/signup", signupLimiter, signup);
router.post("/login", loginLimiter, login);
router.post("/logout", logout);
router.post("/forgot-password", forgotPasswordLimiter, forgotPassword);
router.post("/reset-password/:token", resetPasswordLimiter, resetPassword);
router.post(
  "/verify-email/send",
  protectRoute,
  verificationLimiter,
  sendVerificationOTP,
);
router.post(
  "/verify-email/resend",
  protectRoute,
  verificationLimiter,
  resendVerificationOTP,
);
router.post(
  "/verify-email/verify",
  protectRoute,
  verificationLimiter,
  verifyEmailOTP,
);

router.post("/onboarding", protectRoute, onboard);

//check if user is logged in or not

router.get("/me", protectRoute, (req, res) => {
  res.status(200).json({ success: true, user: req.user });
});

export default router;
