import express from "express";
import rateLimit from "express-rate-limit";
import {
  protectRoute,
  optionalProtectRoute,
} from "../middleware/auth.middleware.js";
import {
  acceptFriendRequest,
  getFriendRequests,
  getMyFriends,
  getOutgoingFriendReqs,
  getRecommendedUsers,
  sendFriendRequest,
  getMyProfile,
  updateMyProfile,
  changeMyPassword,
  deleteMyAccount,
  getFriendsPage,
  discoverUsers,
  getRelationshipRequests,
  removeFriend,
  cancelFriendRequest,
  declineFriendRequest,
  blockUser,
  unblockUser,
  getMutualFriends,
  getBlockedUsers,
  getPublicUserProfile,
  getNotificationPreferences,
  updateNotificationPreferences,
} from "../controllers/user.controller.js";

const router = express.Router();

const relationshipLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60 });
const searchLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 120 });

// Publicly viewable profile route with optional authentication
router.get("/:userId/profile", searchLimiter, optionalProtectRoute, getPublicUserProfile);

// Protected routes below
router.use(protectRoute);

router.get("/me", getMyProfile);
router.patch("/me", updateMyProfile);
router.get("/me/notification-preferences", getNotificationPreferences);
router.patch("/me/notification-preferences", updateNotificationPreferences);
router.post("/me/password", changeMyPassword);
router.delete("/me", deleteMyAccount);

router.get("/friends-page", getFriendsPage);
router.get("/discover", searchLimiter, discoverUsers);
router.get("/relationship-requests", getRelationshipRequests);
router.get("/blocked", getBlockedUsers);
router.get("/:id/mutual-friends", getMutualFriends);
router.delete("/:id/friend", relationshipLimiter, removeFriend);
router.delete("/friend-request/:id", relationshipLimiter, cancelFriendRequest);
router.put(
  "/friend-request/:id/decline",
  relationshipLimiter,
  declineFriendRequest,
);
router.post("/:id/block", relationshipLimiter, blockUser);
router.delete("/:id/block", relationshipLimiter, unblockUser);

router.get("/", getRecommendedUsers);
router.get("/friends", getMyFriends);

router.post("/friend-request/:id", sendFriendRequest);
router.put("/friend-request/:id/accept", acceptFriendRequest);

router.get("/friend-requests", getFriendRequests);
router.get("/outgoing-friend-requests", getOutgoingFriendReqs);

export default router;
