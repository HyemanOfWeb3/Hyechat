import mongoose from "mongoose";
import User from "../models/User.js";
import FriendRequest from "../models/FriendRequest.js";
import Story from "../models/Story.js";
import Notification from "../models/Notification.js";
import MarketplaceListing from "../models/MarketplaceListing.js";
import MarketplaceListingReport from "../models/MarketplaceListingReport.js";
import { deleteStreamStoryMedia, upsertStreamUser } from "../lib/stream.js";
import {
  createNotification,
  DEFAULT_NOTIFICATION_PREFERENCES,
  normalizeNotificationPreferences,
} from "../services/notification.service.js";
import {
  normalizeSocialLink,
  validateAndNormalizeSocialLinks,
} from "../lib/socialLinks.js";

const SOCIAL_PLATFORMS = ["x", "instagram", "facebook", "tiktok"];

const getPublicSocialLinks = (socialLinks = {}) =>
  Object.fromEntries(
    SOCIAL_PLATFORMS.map((platform) => {
      try {
        return [platform, normalizeSocialLink(platform, socialLinks[platform])];
      } catch {
        return [platform, null];
      }
    }),
  );

const getPublicBaseUrl = () => {
  const fallback = "https://hyechat.vercel.app";
  const configured = (process.env.CLIENT_URL || "").split(",")[0]?.trim();
  try {
    const parsed = new URL(configured || fallback);
    const localHost = ["localhost", "127.0.0.1", "[::1]"].includes(
      parsed.hostname,
    );
    if (
      parsed.username ||
      parsed.password ||
      (parsed.protocol !== "https:" &&
        !(parsed.protocol === "http:" && localHost))
    ) {
      return fallback;
    }
    return parsed.origin;
  } catch {
    return fallback;
  }
};

const getSafeProfileImageUrl = (value, fallback) => {
  if (typeof value !== "string" || !value.trim() || value.length > 2048) {
    return fallback;
  }
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== "https:" ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password
    ) {
      return fallback;
    }
    return parsed.href;
  } catch {
    return fallback;
  }
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const profileFields = [
  "fullName",
  "email",
  "bio",
  "profilePic",
  "nativeLanguage",
  "learningLanguage",
  "interests",
  "location",
  "socialLinks",
];

const publicUser = (user) => {
  const data = user.toObject ? user.toObject() : { ...user };
  delete data.password;
  delete data.resetPasswordToken;
  delete data.resetPasswordExpires;
  delete data.emailVerificationOTPHash;
  delete data.emailVerificationExpiresAt;
  delete data.emailVerificationAttempts;
  delete data.emailVerificationLastSentAt;
  delete data.emailVerificationResendCount;
  return {
    ...data,
    notificationPreferences: normalizeNotificationPreferences(
      data.notificationPreferences,
    ),
  };
};

const publicUserCard = (user) => ({
  _id: user._id,
  fullName: user.fullName || "",
  profilePic: user.profilePic || "",
  bio: user.bio || "",
  nativeLanguage: user.nativeLanguage || "",
  learningLanguage: user.learningLanguage || "",
  interests: user.interests || [],
  location: user.location || "",
  socialLinks: user.socialLinks || null,
});

export async function getMyProfile(req, res) {
  res.status(200).json({ success: true, user: publicUser(req.user) });
}

export async function getPublicUserProfile(req, res) {
  const { userId } = req.params;
  if (!mongoose.isValidObjectId(userId)) {
    return res.status(404).json({ message: "Profile not found" });
  }

  try {
    const user = await User.findById(userId).select(
      "fullName profilePic bio nativeLanguage learningLanguage interests location emailVerified isOnboarded friends blockedUsers socialLinks",
    );
    if (!user || !user.isOnboarded) {
      return res.status(404).json({ message: "Profile not found" });
    }

    const viewerId = req.user ? req.user._id.toString() : null;
    const targetId = user._id.toString();
    const isSelf = viewerId ? viewerId === targetId : false;

    let blockedByMe = false;
    let blockedByThem = false;

    if (viewerId) {
      blockedByMe = (req.user.blockedUsers || []).some(
        (id) => id.toString() === targetId,
      );
      blockedByThem = (user.blockedUsers || []).some(
        (id) => id.toString() === viewerId,
      );
    }

    // A block initiated by the viewed user makes the profile unavailable.
    if (blockedByThem) {
      return res.status(404).json({ message: "Profile not found" });
    }

    let relationshipStatus = isSelf ? "self" : blockedByMe ? "blocked" : "none";
    let requestId = null;
    if (viewerId && !isSelf && !blockedByMe) {
      const areFriends = (user.friends || []).some(
        (id) => id.toString() === viewerId,
      );
      if (areFriends) {
        relationshipStatus = "friends";
      } else {
        const request = await FriendRequest.findOne({
          status: "pending",
          $or: [
            { sender: req.user._id, recipient: user._id },
            { sender: user._id, recipient: req.user._id },
          ],
        }).select("_id sender recipient");
        if (request) {
          requestId = request._id;
          relationshipStatus =
            request.sender.toString() === viewerId
              ? "pending_outgoing"
              : "pending_incoming";
        }
      }
    }

    return res.status(200).json({
      profile: {
        _id: user._id,
        fullName: user.fullName,
        profilePic: getSafeProfileImageUrl(user.profilePic, ""),
        bio: user.bio,
        nativeLanguage: user.nativeLanguage,
        learningLanguage: user.learningLanguage,
        interests: user.interests || [],
        location: user.location,
        emailVerified: Boolean(user.emailVerified),
        socialLinks: getPublicSocialLinks(user.socialLinks),
        relationship: {
          status: relationshipStatus,
          requestId,
          blockedByMe,
          blockedByThem,
        },
      },
    });
  } catch (error) {
    console.error("Error getting public user profile", error.message);
    return res.status(500).json({ message: "Unable to load profile" });
  }
}

export async function getNotificationPreferences(req, res) {
  try {
    const user = await User.findById(req.user._id).select(
      "notificationPreferences",
    );
    return res.status(200).json({
      success: true,
      preferences: normalizeNotificationPreferences(
        user?.notificationPreferences,
      ),
    });
  } catch (error) {
    console.error("Error getting notification preferences", error.message);
    return res
      .status(500)
      .json({ message: "Unable to load notification preferences" });
  }
}

export async function updateNotificationPreferences(req, res) {
  try {
    const submittedPreferences = req.body;
    if (
      !submittedPreferences ||
      typeof submittedPreferences !== "object" ||
      Array.isArray(submittedPreferences)
    ) {
      return res
        .status(400)
        .json({ message: "Invalid notification preferences" });
    }

    for (const [category, channels] of Object.entries(submittedPreferences)) {
      if (!Object.hasOwn(DEFAULT_NOTIFICATION_PREFERENCES, category)) {
        return res
          .status(400)
          .json({ message: `Unknown notification category: ${category}` });
      }
      if (
        !channels ||
        typeof channels !== "object" ||
        Array.isArray(channels)
      ) {
        return res
          .status(400)
          .json({ message: `Invalid settings for ${category}` });
      }
      for (const [channel, enabled] of Object.entries(channels)) {
        if (
          !Object.hasOwn(DEFAULT_NOTIFICATION_PREFERENCES[category], channel)
        ) {
          return res
            .status(400)
            .json({ message: `Unknown channel for ${category}` });
        }
        if (typeof enabled !== "boolean") {
          return res
            .status(400)
            .json({ message: `${category}.${channel} must be a boolean` });
        }
      }
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const currentPreferences = normalizeNotificationPreferences(
      user.notificationPreferences,
    );
    const nextPreferences = { ...currentPreferences };
    for (const [category, channels] of Object.entries(submittedPreferences)) {
      nextPreferences[category] = {
        ...currentPreferences[category],
        ...channels,
      };
    }
    user.notificationPreferences = nextPreferences;
    await user.save();

    return res.status(200).json({
      success: true,
      preferences: normalizeNotificationPreferences(
        user.notificationPreferences,
      ),
    });
  } catch (error) {
    console.error("Error updating notification preferences", error.message);
    return res
      .status(500)
      .json({ message: "Unable to update notification preferences" });
  }
}

export async function updateMyProfile(req, res) {
  try {
    const updates = {};
    for (const field of profileFields) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) {
        if (field === "interests") {
          const submitted = req.body[field];
          if (typeof submitted !== "string" && !Array.isArray(submitted)) {
            return res
              .status(400)
              .json({ message: "Interests must be a list of text values" });
          }
          const values =
            typeof submitted === "string" ? submitted.split(",") : submitted;
          if (values.some((value) => typeof value !== "string")) {
            return res
              .status(400)
              .json({ message: "Interests must be text values" });
          }
          updates.interests = [
            ...new Set(values.map((value) => value.trim()).filter(Boolean)),
          ]
            .slice(0, 12)
            .map((value) => value.slice(0, 40));
          continue;
        }
        if (field === "socialLinks") {
          try {
            updates.socialLinks = validateAndNormalizeSocialLinks(
              req.body.socialLinks,
              req.user.socialLinks || {},
            );
          } catch (validationErr) {
            return res.status(400).json({ message: validationErr.message });
          }
          continue;
        }
        updates[field] =
          typeof req.body[field] === "string"
            ? req.body[field].trim()
            : req.body[field];
      }
    }

    const candidate = {
      fullName: req.user.fullName,
      email: req.user.email,
      bio: req.user.bio || "",
      profilePic: req.user.profilePic || "",
      location: req.user.location || "",
      interests: req.user.interests || [],
      socialLinks: req.user.socialLinks || {},
      ...updates,
    };

    if (!candidate.fullName || candidate.fullName.length > 100) {
      return res.status(400).json({
        message: "Full name is required and must be under 100 characters",
      });
    }
    if (
      !candidate.email ||
      !emailRegex.test(candidate.email) ||
      candidate.email.length > 254
    ) {
      return res
        .status(400)
        .json({ message: "Please provide a valid email address" });
    }
    if (candidate.bio.length > 500 || candidate.location.length > 120) {
      return res
        .status(400)
        .json({ message: "Profile text is longer than allowed" });
    }
    if (candidate.profilePic && !/^https?:\/\/.+/i.test(candidate.profilePic)) {
      return res
        .status(400)
        .json({ message: "Profile picture must be a valid image URL" });
    }

    const duplicateEmail = await User.findOne({
      email: candidate.email,
      _id: { $ne: req.user._id },
    });
    if (duplicateEmail) {
      return res.status(409).json({ message: "Email is already in use" });
    }

    if (
      candidate.email.toLowerCase() !==
      String(req.user.email || "").toLowerCase()
    ) {
      Object.assign(updates, {
        emailVerified: false,
        emailVerificationOTPHash: null,
        emailVerificationExpiresAt: null,
        emailVerificationAttempts: 0,
        emailVerificationLastSentAt: null,
        emailVerificationResendCount: 0,
      });
    }

    const updatedUser = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });
    if (!updatedUser)
      return res.status(404).json({ message: "User not found" });

    try {
      await upsertStreamUser({
        id: updatedUser._id.toString(),
        name: updatedUser.fullName,
        image: updatedUser.profilePic || "",
      });
    } catch (error) {
      console.error("Error updating Stream profile", error.message);
    }

    res.status(200).json({ success: true, user: publicUser(updatedUser) });
  } catch (error) {
    console.error("Error updating profile", error.message);
    res.status(500).json({ message: "Unable to update profile" });
  }
}

export async function changeMyPassword(req, res) {
  const { currentPassword, newPassword, confirmPassword } = req.body || {};
  if (!currentPassword || !newPassword || !confirmPassword) {
    return res
      .status(400)
      .json({ message: "All password fields are required" });
  }
  if (newPassword.length < 6) {
    return res
      .status(400)
      .json({ message: "Password must be at least 6 characters" });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "New passwords do not match" });
  }

  try {
    const user = await User.findById(req.user._id);
    if (!user || !(await user.matchPassword(currentPassword))) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }
    user.password = newPassword;
    await user.save();
    res
      .status(200)
      .json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Error changing password", error.message);
    res.status(500).json({ message: "Unable to change password" });
  }
}

export async function deleteMyAccount(req, res) {
  const { currentPassword } = req.body || {};
  if (!currentPassword) {
    return res.status(400).json({ message: "Current password is required" });
  }

  try {
    const user = await User.findById(req.user._id);
    if (!user || !(await user.matchPassword(currentPassword))) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    const userId = user._id;
    const marketplaceListingIds = await MarketplaceListing.find({
      seller: userId,
    }).distinct("_id");
    const stories = await Story.find({ user: userId }).select(
      "mediaUrl mediaType",
    );
    const mediaCleanup = await Promise.allSettled(
      stories.map((story) =>
        deleteStreamStoryMedia(story.mediaUrl, story.mediaType),
      ),
    );
    mediaCleanup.forEach((result) => {
      if (result.status === "rejected") {
        console.warn("Could not clean up Story media during account deletion");
      }
    });

    await Promise.all([
      Story.deleteMany({ user: userId }),
      MarketplaceListing.deleteMany({ seller: userId }),
      MarketplaceListingReport.deleteMany({
        $or: [
          { reporter: userId },
          { listing: { $in: marketplaceListingIds } },
        ],
      }),
      User.updateMany(
        { savedMarketplaceListings: { $in: marketplaceListingIds } },
        { $pull: { savedMarketplaceListings: { $in: marketplaceListingIds } } },
      ),
      Notification.deleteMany({
        $or: [{ recipient: userId }, { actor: userId }],
      }),
      FriendRequest.deleteMany({
        $or: [{ sender: userId }, { recipient: userId }],
      }),
      User.updateMany({ friends: userId }, { $pull: { friends: userId } }),
      User.deleteOne({ _id: userId }),
    ]);

    res.clearCookie("jwt");
    res
      .status(200)
      .json({ success: true, message: "Account deleted successfully" });
  } catch (error) {
    console.error("Error deleting account", error.message);
    res.status(500).json({ message: "Unable to delete account" });
  }
}

const USER_PROJECTION =
  "fullName profilePic bio nativeLanguage learningLanguage interests location";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getTargetUser = async (id, currentUserId) => {
  if (!mongoose.isValidObjectId(id) || id === currentUserId.toString())
    return null;
  return User.findById(id).select(
    "_id friends blockedUsers fullName profilePic bio nativeLanguage learningLanguage interests location",
  );
};

const relationshipFor = (currentUser, targetId, requestsByPair) => {
  const target = targetId.toString();
  if ((currentUser.blockedUsers || []).some((id) => id.toString() === target))
    return "blocked";
  if ((currentUser.friends || []).some((id) => id.toString() === target))
    return "friends";
  const request = requestsByPair?.get(target);
  return request?.sender.toString() === currentUser._id.toString()
    ? "outgoing"
    : request
      ? "incoming"
      : "none";
};

const serializeUser = (
  user,
  relationship,
  mutualFriends = 0,
  requestId = null,
  currentInterests = new Set(),
) => ({
  ...publicUser(user),
  relationship,
  relationshipStatus: relationship,
  requestId,
  mutualFriends,
  sharedInterests: (user.interests || []).filter((interest) =>
    currentInterests.has(interest.toLowerCase()),
  ),
});

export async function getFriendsPage(req, res) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(
    50,
    Math.max(1, Number.parseInt(req.query.limit, 10) || 20),
  );
  try {
    const [friendPage] = await User.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(req.user._id) } },
      {
        $project: {
          total: { $size: "$friends" },
          friendIds: { $slice: ["$friends", (page - 1) * limit, limit] },
        },
      },
    ]);
    const friends = friendPage?.friendIds?.length
      ? await User.find({ _id: { $in: friendPage.friendIds } }).select(
          USER_PROJECTION,
        )
      : [];
    const friendById = new Map(
      friends.map((friend) => [friend._id.toString(), friend]),
    );
    const orderedFriends = (friendPage?.friendIds || [])
      .map((friendId) => friendById.get(friendId.toString()))
      .filter(Boolean);
    const total = friendPage?.total || 0;
    return res.status(200).json({
      users: orderedFriends.map((friend) => serializeUser(friend, "friends")),
      pagination: { page, limit, hasMore: page * limit < total },
    });
  } catch (error) {
    console.error("Error getting paginated friends", error.message);
    return res.status(500).json({ message: "Unable to load friends" });
  }
}

export async function discoverUsers(req, res) {
  const query =
    typeof req.query.query === "string" ? req.query.query.trim() : "";
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(
    50,
    Math.max(1, Number.parseInt(req.query.limit, 10) || 20),
  );
  try {
    const currentUser = await User.findById(req.user._id)
      .select("friends blockedUsers nativeLanguage learningLanguage interests")
      .lean();
    const excluded = [req.user._id, ...(currentUser?.blockedUsers || [])];
    const blockedBy = await User.find({ blockedUsers: req.user._id }).distinct(
      "_id",
    );
    excluded.push(...blockedBy);
    const filter = { _id: { $nin: excluded }, isOnboarded: true };
    if (query) {
      const search = { $regex: escapeRegex(query), $options: "i" };
      filter.$or = [
        { fullName: search },
        { nativeLanguage: search },
        { learningLanguage: search },
        { interests: search },
      ];
    }
    const relevanceTerms = [];
    if (currentUser?.learningLanguage) {
      relevanceTerms.push({
        $cond: [
          { $eq: ["$nativeLanguage", currentUser.learningLanguage] },
          3,
          0,
        ],
      });
    }
    if (currentUser?.nativeLanguage) {
      relevanceTerms.push({
        $cond: [
          { $eq: ["$learningLanguage", currentUser.nativeLanguage] },
          2,
          0,
        ],
      });
    }
    if (currentUser?.interests?.length) {
      relevanceTerms.push({
        $size: {
          $setIntersection: [
            {
              $map: {
                input: { $ifNull: ["$interests", []] },
                as: "interest",
                in: { $toLower: "$$interest" },
              },
            },
            currentUser.interests.map((interest) => interest.toLowerCase()),
          ],
        },
      });
    }
    const [users, total, requests] = await Promise.all([
      User.aggregate([
        { $match: filter },
        {
          $addFields: {
            relevanceScore: {
              $add: relevanceTerms.length ? relevanceTerms : [0],
            },
          },
        },
        { $sort: { relevanceScore: -1, fullName: 1, _id: 1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        {
          $project: {
            fullName: 1,
            profilePic: 1,
            bio: 1,
            nativeLanguage: 1,
            learningLanguage: 1,
            interests: 1,
            location: 1,
          },
        },
      ]),
      User.countDocuments(filter),
      FriendRequest.find({
        $or: [{ sender: req.user._id }, { recipient: req.user._id }],
        status: "pending",
      })
        .select("sender recipient")
        .lean(),
    ]);
    const requestMap = new Map();
    const currentInterests = new Set(
      (currentUser?.interests || []).map((interest) => interest.toLowerCase()),
    );
    requests.forEach((request) =>
      requestMap.set(
        request.sender.toString() === req.user._id.toString()
          ? request.recipient.toString()
          : request.sender.toString(),
        request,
      ),
    );
    return res.status(200).json({
      users: users.map((user) => {
        const relationship = relationshipFor(currentUser, user._id, requestMap);
        const request = requestMap.get(user._id.toString());
        return serializeUser(
          user,
          relationship,
          0,
          request?._id || null,
          currentInterests,
        );
      }),
      pagination: { page, limit, hasMore: page * limit < total },
    });
  } catch (error) {
    console.error("Error discovering users", error.message);
    return res.status(500).json({ message: "Unable to discover users" });
  }
}

export async function getBlockedUsers(req, res) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(
    50,
    Math.max(1, Number.parseInt(req.query.limit, 10) || 20),
  );

  try {
    const [blockedPage] = await User.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(req.user._id) } },
      {
        $project: {
          total: { $size: { $ifNull: ["$blockedUsers", []] } },
          userIds: {
            $slice: [
              { $ifNull: ["$blockedUsers", []] },
              (page - 1) * limit,
              limit,
            ],
          },
        },
      },
    ]);
    const users = blockedPage?.userIds?.length
      ? await User.find({ _id: { $in: blockedPage.userIds } }).select(
          USER_PROJECTION,
        )
      : [];
    const usersById = new Map(users.map((user) => [user._id.toString(), user]));
    const orderedUsers = (blockedPage?.userIds || [])
      .map((userId) => usersById.get(userId.toString()))
      .filter(Boolean);

    return res.status(200).json({
      users: orderedUsers.map((user) => ({
        ...serializeUser(user, "blocked"),
        blockedAt: null,
      })),
      pagination: {
        page,
        limit,
        hasMore: page * limit < (blockedPage?.total || 0),
      },
    });
  } catch (error) {
    console.error("Error getting blocked users", error.message);
    return res.status(500).json({ message: "Unable to load blocked users" });
  }
}

export async function getRelationshipRequests(req, res) {
  try {
    const [incoming, outgoing] = await Promise.all([
      FriendRequest.find({ recipient: req.user._id, status: "pending" })
        .populate("sender", USER_PROJECTION)
        .sort({ createdAt: -1 })
        .limit(50),
      FriendRequest.find({ sender: req.user._id, status: "pending" })
        .populate("recipient", USER_PROJECTION)
        .sort({ createdAt: -1 })
        .limit(50),
    ]);
    return res.status(200).json({ incoming, outgoing });
  } catch (error) {
    console.error("Error getting relationship requests", error.message);
    return res.status(500).json({ message: "Unable to load friend requests" });
  }
}

const validateTarget = async (req, res) => {
  const target = await getTargetUser(req.params.id, req.user._id);
  if (!target) {
    res.status(400).json({ message: "Invalid or unavailable user" });
    return null;
  }
  return target;
};

export async function removeFriend(req, res) {
  const target = await validateTarget(req, res);
  if (!target) return;
  await User.updateMany(
    { _id: { $in: [req.user._id, target._id] } },
    { $pull: { friends: { $in: [req.user._id, target._id] } } },
  );
  await createNotification({
    recipient: target._id,
    actor: req.user._id,
    type: "friend_removed",
  });
  return res.status(200).json({ success: true, message: "Friend removed" });
}

export async function cancelFriendRequest(req, res) {
  const request = await FriendRequest.findOneAndDelete({
    _id: req.params.id,
    sender: req.user._id,
    status: "pending",
  });
  if (!request)
    return res.status(404).json({ message: "Pending request not found" });
  await createNotification({
    recipient: request.recipient,
    actor: request.sender,
    type: "friend_cancelled",
  });
  return res
    .status(200)
    .json({ success: true, message: "Friend request cancelled" });
}

export async function declineFriendRequest(req, res) {
  const request = await FriendRequest.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id, status: "pending" },
    { status: "rejected" },
    { new: true },
  );
  if (!request)
    return res.status(404).json({ message: "Pending request not found" });
  await createNotification({
    recipient: request.sender,
    actor: request.recipient,
    type: "friend_declined",
  });
  return res
    .status(200)
    .json({ success: true, message: "Friend request declined" });
}

export async function blockUser(req, res) {
  const target = await validateTarget(req, res);
  if (!target) return;
  const userId = req.user._id;
  await Promise.all([
    User.findByIdAndUpdate(userId, {
      $addToSet: { blockedUsers: target._id },
      $pull: { friends: target._id },
    }),
    User.findByIdAndUpdate(target._id, { $pull: { friends: userId } }),
    FriendRequest.deleteMany({
      $or: [
        { sender: userId, recipient: target._id },
        { sender: target._id, recipient: userId },
      ],
    }),
  ]);
  return res.status(200).json({
    success: true,
    message: "User blocked",
    relationship: { status: "blocked", requestId: null },
  });
}

export async function unblockUser(req, res) {
  const target = await validateTarget(req, res);
  if (!target) return;
  await User.findByIdAndUpdate(req.user._id, {
    $pull: { blockedUsers: target._id },
  });
  return res.status(200).json({
    success: true,
    message: "User unblocked",
    relationship: { status: "none", requestId: null },
  });
}

export async function getMutualFriends(req, res) {
  const target = await validateTarget(req, res);
  if (!target) return;
  const current = await User.findById(req.user._id).select("friends").lean();
  const mutuals = await User.find({
    _id: {
      $in: current.friends.filter((id) =>
        target.friends.some((friendId) => friendId.equals(id)),
      ),
    },
  })
    .select(USER_PROJECTION)
    .limit(50);
  return res.status(200).json({
    users: mutuals.map((user) => publicUser(user)),
    count: mutuals.length,
  });
}

export async function getRecommendedUsers(req, res) {
  try {
    const currentUserId = req.user._id;
    const currentUser = req.user;
    const blockedBy = await User.find({ blockedUsers: currentUserId }).distinct(
      "_id",
    );
    const excludedIds = [
      currentUserId,
      ...(currentUser.friends || []),
      ...(currentUser.blockedUsers || []),
      ...blockedBy,
    ];

    const recommendedUsers = await User.find({
      _id: { $nin: excludedIds },
      isOnboarded: true,
    })
      .select(USER_PROJECTION)
      .limit(50);

    res.status(200).json(recommendedUsers.map(publicUserCard));
  } catch (error) {
    console.error("Error in getRecommendedUsers", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getMyFriends(req, res) {
  try {
    const user = await User.findById(req.user.id)
      .select("friends")
      .populate(
        "friends",
        "fullName profilePic bio nativeLanguage learningLanguage location",
      );

    // if (!user) {
    //     return res.status(404).json({ message: "User not found" });
    // }

    res.status(200).json(user.friends);
  } catch (error) {
    console.error("Error in getMyFriends", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function sendFriendRequest(req, res) {
  try {
    const myId = req.user.id;
    const { id: recipientId } = req.params;

    if (myId === recipientId) {
      return res
        .status(400)
        .json({ message: "You can't send friend request to yourself" });
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: "Recipient not found" });
    }

    if (
      recipient.blockedUsers?.some((id) => id.toString() === myId) ||
      req.user.blockedUsers?.some((id) => id.toString() === recipientId)
    ) {
      return res.status(403).json({ message: "This user is unavailable" });
    }

    //check if user is already friends
    if (recipient.friends.includes(myId)) {
      return res
        .status(400)
        .json({ message: "You are already friends with this user" });
    }

    //check if a req already exists
    const existingRequest = await FriendRequest.findOne({
      status: "pending",
      $or: [
        { sender: myId, recipient: recipientId },
        { sender: recipientId, recipient: myId },
      ],
    });

    if (existingRequest) {
      return res.status(200).json({
        message: "A friend request already exists between you and this user",
        existingRequest,
        relationship: {
          status:
            existingRequest.sender.toString() === myId
              ? "pending_outgoing"
              : "pending_incoming",
          requestId: existingRequest._id,
        },
      });
    }

    const friendRequest = await FriendRequest.create({
      sender: myId,
      recipient: recipientId,
    });

    await createNotification({
      recipient: recipientId,
      actor: myId,
      type: "friend_request",
    });

    res.status(201).json({
      success: true,
      request: friendRequest,
      relationship: {
        status: "pending_outgoing",
        requestId: friendRequest._id,
      },
    });
  } catch (error) {
    console.error("Error in sendFriendRequest", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function acceptFriendRequest(req, res) {
  try {
    const { id: requestId } = req.params;

    const existingRequest = await FriendRequest.findById(requestId);

    if (!existingRequest) {
      return res.status(404).json({ message: "Friend request not found" });
    }

    //Verify the current user is the recipient
    if (existingRequest.recipient.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "You are not authorized to accept this request" });
    }

    const friendRequest = await FriendRequest.findOneAndUpdate(
      {
        _id: requestId,
        recipient: req.user._id,
        status: "pending",
      },
      { $set: { status: "accepted" } },
      { new: true },
    );
    if (!friendRequest) {
      return res
        .status(409)
        .json({ message: "Friend request is no longer pending" });
    }

    // add each user to the other's friends array
    await User.findByIdAndUpdate(friendRequest.sender, {
      $addToSet: { friends: friendRequest.recipient },
    });

    await User.findByIdAndUpdate(friendRequest.recipient, {
      $addToSet: { friends: friendRequest.sender },
    });

    await createNotification({
      recipient: friendRequest.sender,
      actor: friendRequest.recipient,
      type: "friend_accepted",
    });

    res.status(200).json({ message: "Friend request accepted" });
  } catch (error) {
    console.log("Error in acceptFriendRequest controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getFriendRequests(req, res) {
  try {
    const incomingReqs = await FriendRequest.find({
      recipient: req.user.id,
      status: "pending",
    }).populate(
      "sender",
      "fullName profilePic nativeLanguage learningLanguage",
    );

    const acceptedReqs = await FriendRequest.find({
      sender: req.user.id,
      status: "accepted",
    }).populate("recipient", "fullName profilePic");

    res.status(200).json({ incomingReqs, acceptedReqs });
  } catch (error) {
    console.log("Error in getPendingFriendRequests controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getOutgoingFriendReqs(req, res) {
  try {
    const outgoingRequests = await FriendRequest.find({
      sender: req.user.id,
      status: "pending",
    }).populate(
      "recipient",
      "fullName profilePic nativeLanguage learningLanguage",
    );

    res.status(200).json(outgoingRequests);
  } catch (error) {
    console.log("Error in getOutgoingFriendReqs controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function getProfileOpenGraph(req, res) {
  const { userId } = req.params;
  const baseUrl = getPublicBaseUrl();
  const fallbackTitle = "HyeChat — Global Language Exchange & Chat";
  const fallbackDesc =
    "Connect with native speakers and language partners around the world.";
  const fallbackImage = escapeHtml(`${baseUrl}/hyechat-preview.svg`);

  if (!mongoose.isValidObjectId(userId)) {
    return res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${fallbackTitle}</title>
  <meta property="og:title" content="${fallbackTitle}">
  <meta property="og:description" content="${fallbackDesc}">
  <meta property="og:image" content="${fallbackImage}">
  <meta name="twitter:card" content="summary_large_image">
  <meta http-equiv="refresh" content="0;url=/">
</head>
<body><p>Redirecting to HyeChat...</p></body>
</html>`);
  }

  try {
    const user = await User.findById(userId).select(
      "fullName profilePic bio nativeLanguage learningLanguage location emailVerified isOnboarded socialLinks",
    );

    if (!user || !user.isOnboarded) {
      return res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${fallbackTitle}</title>
  <meta property="og:title" content="${fallbackTitle}">
  <meta property="og:description" content="${fallbackDesc}">
  <meta property="og:image" content="${fallbackImage}">
  <meta name="twitter:card" content="summary_large_image">
  <meta http-equiv="refresh" content="0;url=/">
</head>
<body><p>Profile unavailable. Redirecting to HyeChat...</p></body>
</html>`);
    }

    const name = escapeHtml(user.fullName);
    const summary = user.bio?.trim()
      ? escapeHtml(user.bio.trim().slice(0, 200))
      : escapeHtml(
          `Connect with ${user.fullName} on HyeChat — Global Language Exchange & Chat.`,
        );
    const profilePath = `/profile/${encodeURIComponent(user._id.toString())}`;
    const profileUrl = escapeHtml(`${baseUrl}${profilePath}`);
    const imageUrl = escapeHtml(
      getSafeProfileImageUrl(
        user.profilePic,
        `${baseUrl}/api/og/image/${encodeURIComponent(user._id.toString())}`,
      ),
    );

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name} on HyeChat</title>
  <meta name="description" content="${summary}">

  <!-- Open Graph / Facebook / WhatsApp / Telegram -->
  <meta property="og:type" content="profile">
  <meta property="og:site_name" content="HyeChat">
  <meta property="og:title" content="${name} on HyeChat">
  <meta property="og:description" content="${summary}">
  <meta property="og:url" content="${profileUrl}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:alt" content="${name}'s HyeChat profile">

  <!-- Twitter / X -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@HyeChat">
  <meta name="twitter:title" content="${name} on HyeChat">
  <meta name="twitter:description" content="${summary}">
  <meta name="twitter:image" content="${imageUrl}">

  <link rel="canonical" href="${profileUrl}">
  <meta http-equiv="refresh" content="0;url=${escapeHtml(profilePath)}">
</head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#0d1117;color:#f0f6fc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:1rem;text-align:center;">
  <div style="max-width:480px;background:#161b22;border:1px solid #30363d;border-radius:16px;padding:24px;">
    <h1 style="margin:0 0 8px;font-size:24px;">${name}</h1>
    <p style="margin:0 0 16px;color:#8b949e;font-size:14px;">${summary}</p>
    <a href="${escapeHtml(profilePath)}" style="display:inline-block;background:#3b82f6;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;font-size:14px;">View Profile on HyeChat &rarr;</a>
  </div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=600, s-maxage=3600");
    return res.status(200).send(html);
  } catch (error) {
    console.error("Error generating Open Graph preview", error.message);
    return res.status(500).send("Unable to load profile preview");
  }
}

export async function getProfileShareImage(req, res) {
  const { userId } = req.params;
  try {
    let name = "HyeChat";
    let bio = "";
    let languages = "";
    let isEmailVerified = false;

    if (mongoose.isValidObjectId(userId)) {
      const user = await User.findOne({
        _id: userId,
        isOnboarded: true,
      }).select("fullName bio nativeLanguage learningLanguage emailVerified");
      if (user) {
        name = escapeHtml(user.fullName || "HyeChat member");
        bio = user.bio?.trim() ? escapeHtml(user.bio.trim().slice(0, 110)) : "";
        isEmailVerified = Boolean(user.emailVerified);
        const langs = [user.nativeLanguage, user.learningLanguage].filter(
          Boolean,
        );
        if (langs.length) {
          languages = escapeHtml(
            langs
              .map((l) => l.charAt(0).toUpperCase() + l.slice(1))
              .join(" • "),
          );
        }
      }
    }

    const initials = escapeHtml(name.charAt(0).toUpperCase());
    const verifiedBadge = isEmailVerified
      ? `<rect x="0" y="60" width="180" height="28" rx="14" fill="#065f46" opacity="0.8"/>
    <text x="14" y="79" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="700" fill="#34d399">✓ EMAIL VERIFIED</text>`
      : "";
    const bioText = bio
      ? `<text x="0" y="125" font-family="system-ui, -apple-system, sans-serif" font-size="22" fill="#94a3b8">${bio}</text>`
      : "";
    const languagePill = languages
      ? `<g>
    <rect x="0" y="0" width="300" height="42" rx="21" fill="#1e293b"/>
    <text x="20" y="27" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="600" fill="#cbd5e1">🌍 ${languages}</text>
  </g>`
      : "";
    const publicHost = new URL(getPublicBaseUrl()).host;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a0f1d"/>
      <stop offset="50%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e1b4b"/>
    </linearGradient>
    <linearGradient id="primaryGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#8b5cf6"/>
    </linearGradient>
    <linearGradient id="avatarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#ec4899"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1050" cy="120" r="320" fill="#6366f1" opacity="0.12"/>
  <circle cx="150" cy="520" r="260" fill="#ec4899" opacity="0.10"/>

  <!-- Card Frame -->
  <rect x="80" y="60" width="1040" height="510" rx="32" fill="#131b2e" stroke="#25324e" stroke-width="2"/>

  <!-- Brand Header -->
  <g transform="translate(140, 120)">
    <circle cx="24" cy="24" r="24" fill="url(#primaryGrad)"/>
    <path d="M24 10 L24 38 M10 24 L38 24 M14 14 L34 34 M14 34 L34 14" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
    <text x="64" y="34" font-family="system-ui, -apple-system, sans-serif" font-size="32" font-weight="800" fill="#ffffff" letter-spacing="1">HyeChat</text>
    <rect x="220" y="10" width="120" height="30" rx="15" fill="#1e293b"/>
    <text x="242" y="30" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="700" fill="#38bdf8" letter-spacing="1">PROFILE</text>
  </g>

  <!-- Avatar -->
  <g transform="translate(140, 210)">
    <circle cx="65" cy="65" r="65" fill="url(#avatarGrad)"/>
    <text x="65" y="85" font-family="system-ui, -apple-system, sans-serif" font-size="58" font-weight="800" fill="#ffffff" text-anchor="middle">${initials}</text>
  </g>

  <!-- User Details -->
  <g transform="translate(300, 225)">
    <text x="0" y="40" font-family="system-ui, -apple-system, sans-serif" font-size="44" font-weight="800" fill="#ffffff">${name}</text>
    ${verifiedBadge}
    ${bioText}
  </g>

  <!-- Footer Pills -->
  <g transform="translate(140, 470)">
    ${languagePill}
    <text x="820" y="27" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="600" fill="#64748b" text-anchor="end">${escapeHtml(publicHost)}</text>
  </g>
</svg>`;

    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800");
    return res.status(200).send(svg);
  } catch (error) {
    console.error("Error generating profile share image", error.message);
    return res.status(500).send("Unable to generate image");
  }
}
