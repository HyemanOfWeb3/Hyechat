import express from "express";
import rateLimit from "express-rate-limit";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  createCommunity,
  getMyCommunities,
  getCommunity,
  getInvitePreview,
  joinByInvite,
  updateCommunity,
  regenerateInvite,
  revokeInvite,
  leaveCommunity,
  removeCommunityMember,
  setCommunityMemberRole,
  transferCommunityOwnership,
  deleteCommunity,
} from "../controllers/community.controller.js";

const router = express.Router();
const inviteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

router.get("/invite/:token", inviteLimiter, getInvitePreview);
router.use(protectRoute);
router.post("/invite/:token/join", inviteLimiter, joinByInvite);
router.get("/", getMyCommunities);
router.post("/", createCommunity);
router.get("/:id", getCommunity);
router.patch("/:id", updateCommunity);
router.post("/:id/invite/regenerate", inviteLimiter, regenerateInvite);
router.post("/:id/invite/revoke", revokeInvite);
router.post("/:id/leave", leaveCommunity);
router.delete("/:id", deleteCommunity);
router.delete("/:id/members/:userId", removeCommunityMember);
router.patch("/:id/members/:userId/role", setCommunityMemberRole);
router.patch("/:id/owner/:userId", transferCommunityOwnership);

export default router;
