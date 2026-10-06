import mongoose from "mongoose";
import User from "../models/User.js";
import FriendRequest from "../models/FriendRequest.js";
import Story from "../models/Story.js";
import Notification from "../models/Notification.js";
import { deleteStreamStoryMedia, upsertStreamUser } from "../lib/stream.js";
import {
  createNotification,
  DEFAULT_NOTIFICATION_PREFERENCES,
  normalizeNotificationPreferences,
} from "../services/notification.service.js";

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

export async function getMyProfile(req, res) {
  res.status(200).json({ success: true, user: publicUser(req.user) });
}

export async function getNotificationPreferences(req, res) {
  try {
    const user = await User.findById(req.user._id).select("notificationPreferences");
    return res.status(200).json({
      success: true,
      preferences: normalizeNotificationPreferences(user?.notificationPreferences),
    });
  } catch (error) {
    console.error("Error getting notification preferences", error.message);
    return res.status(500).json({ message: "Unable to load notification preferences" });
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
      return res.status(400).json({ message: "Invalid notification preferences" });
    }

    for (const [category, channels] of Object.entries(submittedPreferences)) {
      if (!Object.hasOwn(DEFAULT_NOTIFICATION_PREFERENCES, category)) {
        return res.status(400).json({ message: `Unknown notification category: ${category}` });
      }
      if (!channels || typeof channels !== "object" || Array.isArray(channels)) {
        return res.status(400).json({ message: `Invalid settings for ${category}` });
      }
      for (const [channel, enabled] of Object.entries(channels)) {
        if (!Object.hasOwn(DEFAULT_NOTIFICATION_PREFERENCES[category], channel)) {
          return res.status(400).json({ message: `Unknown channel for ${category}` });
        }
        if (typeof enabled !== "boolean") {
          return res.status(400).json({ message: `${category}.${channel} must be a boolean` });
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
      nextPreferences[category] = { ...currentPreferences[category], ...channels };
    }
    user.notificationPreferences = nextPreferences;
    await user.save();

    return res.status(200).json({
      success: true,
      preferences: normalizeNotificationPreferences(user.notificationPreferences),
    });
  } catch (error) {
    console.error("Error updating notification preferences", error.message);
    return res.status(500).json({ message: "Unable to update notification preferences" });
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
            return res.status(400).json({ message: "Interests must be a list of text values" });
          }
          const values = typeof submitted === "string" ? submitted.split(",") : submitted;
          if (values.some((value) => typeof value !== "string")) {
            return res.status(400).json({ message: "Interests must be text values" });
          }
          updates.interests = [...new Set(
            values.map((value) => value.trim()).filter(Boolean),
          )].slice(0, 12).map((value) => value.slice(0, 40));
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
    "_id friends blockedUsers fullName profilePic bio nativeLanguage learningLanguage location",
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
            relevanceScore: { $add: relevanceTerms.length ? relevanceTerms : [0] },
          },
        },
        { $sort: { relevanceScore: -1, fullName: 1, _id: 1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        { $project: { fullName: 1, profilePic: 1, bio: 1, nativeLanguage: 1, learningLanguage: 1, interests: 1, location: 1 } },
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

    const recommendedUsers = await User.find({
      $and: [
        { _id: { $ne: currentUserId } }, // Exclude current user
        { _id: { $nin: currentUser.friends } }, // Exclude friends
        { isOnboarded: true }, // Only include onboarded users
      ],
    });

    res.status(200).json(recommendedUsers);
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

    const friendRequest = await FriendRequest.findById(requestId);

    if (!friendRequest) {
      return res.status(404).json({ message: "Friend request not found" });
    }

    //Verify the current user is the recipient
    if (friendRequest.recipient.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "You are not authorized to accept this request" });
    }

    friendRequest.status = "accepted";
    await friendRequest.save();

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
