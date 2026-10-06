import mongoose from "mongoose";
import Story from "../models/Story.js";
import User from "../models/User.js";
import { deleteStreamStoryMedia } from "../lib/stream.js";
import { createNotification } from "../services/notification.service.js";

const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;
const MAX_MEDIA_URL_LENGTH = 2048;
const MAX_STORY_SIZE = 10 * 1024 * 1024;
const MAX_STORY_DURATION_SECONDS = 60.5;
const STREAM_CDN_HOST_SUFFIX = "stream-io-cdn.com";
const STORY_REPORT_REASONS = ["spam", "inappropriate", "harassment", "other"];

const getVisibleUserIds = (user) => [
  user._id,
  ...(Array.isArray(user.friends) ? user.friends : []),
];

const normalizeViewerIds = (viewers = []) => {
  const uniqueViewerIds = new Set();

  (Array.isArray(viewers) ? viewers : []).forEach((viewer) => {
    const viewerId =
      viewer && typeof viewer.toString === "function"
        ? viewer.toString()
        : viewer;

    if (viewerId) uniqueViewerIds.add(viewerId);
  });

  return Array.from(uniqueViewerIds);
};

const sanitizeStoryForUser = (storyObj, currentUserId) => {
  const ownerId = storyObj.user?._id || storyObj.user;
  const isOwner = ownerId && ownerId.toString() === currentUserId.toString();
  const normalizedViewers = normalizeViewerIds(storyObj.viewers);

  const sanitizedStory = { ...storyObj };
  sanitizedStory.viewedByMe =
    isOwner ||
    normalizedViewers.some((viewerId) => viewerId === currentUserId.toString());

  delete sanitizedStory.reports;

  if (!isOwner) {
    sanitizedStory.viewers = [];
    if (Array.isArray(sanitizedStory.reactions)) {
      const userReaction = sanitizedStory.reactions.find(
        (reaction) => reaction.user.toString() === currentUserId.toString(),
      );
      sanitizedStory.reactions = userReaction ? [userReaction] : [];
    }
    return sanitizedStory;
  }

  sanitizedStory.viewers = normalizedViewers;
  return sanitizedStory;
};

const isVisibleToUser = (story, user) => {
  if (story.user.toString() === user._id.toString()) return true;
  if (story.privacy === "only_me") return false;
  if (
    (user.hiddenStoryUsers || []).some(
      (id) => id.toString() === story.user.toString(),
    )
  ) {
    return false;
  }

  return (user.friends || []).some(
    (userId) => userId.toString() === story.user.toString(),
  );
};

const isValidStreamImageUrl = (mediaUrl) => {
  if (typeof mediaUrl !== "string" || !mediaUrl.trim()) return false;
  if (mediaUrl.length > MAX_MEDIA_URL_LENGTH) return false;

  try {
    const parsedUrl = new URL(mediaUrl);
    const hostname = parsedUrl.hostname.toLowerCase();

    return (
      parsedUrl.protocol === "https:" &&
      !parsedUrl.username &&
      !parsedUrl.password &&
      !parsedUrl.port &&
      (hostname === STREAM_CDN_HOST_SUFFIX ||
        hostname.endsWith(`.${STREAM_CDN_HOST_SUFFIX}`)) &&
      Boolean(parsedUrl.pathname && parsedUrl.pathname !== "/")
    );
  } catch {
    return false;
  }
};

export async function createStory(req, res) {
  const { mediaUrl, mediaType, mediaSize, durationSeconds, privacy } =
    req.body || {};
  const caption =
    typeof req.body?.text === "string" ? req.body.text.trim() : "";
  const prompt =
    typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";

  if (caption.length > 500) {
    return res.status(400).json({
      message: "Story captions must be 500 characters or fewer",
    });
  }

  if (!mediaUrl) {
    return res.status(400).json({ message: "Story media URL is required" });
  }

  if (!["image", "video"].includes(mediaType)) {
    return res
      .status(400)
      .json({ message: "Only image and video stories are supported" });
  }

  if (!isValidStreamImageUrl(mediaUrl)) {
    return res.status(400).json({ message: "Invalid Story media URL" });
  }

  if (
    !Number.isFinite(Number(mediaSize)) ||
    Number(mediaSize) <= 0 ||
    Number(mediaSize) > MAX_STORY_SIZE
  ) {
    return res
      .status(400)
      .json({ message: "Story media must be 10 MB or less" });
  }

  if (
    mediaType === "video" &&
    (durationSeconds === undefined ||
      !Number.isFinite(Number(durationSeconds)) ||
      Number(durationSeconds) <= 0 ||
      Number(durationSeconds) > MAX_STORY_DURATION_SECONDS)
  ) {
    return res.status(400).json({
      message: "Story videos must be 60 seconds or shorter",
    });
  }

  if (prompt.length > 200) {
    return res
      .status(400)
      .json({ message: "Story prompts must be 200 characters or fewer" });
  }

  if (privacy !== undefined && !["friends", "only_me"].includes(privacy)) {
    return res.status(400).json({ message: "Invalid Story privacy setting" });
  }

  try {
    const createdAt = new Date();
    const story = await Story.create({
      user: req.user._id,
      mediaUrl: mediaUrl.trim(),
      mediaType,
      ...(mediaSize !== undefined ? { mediaSize: Number(mediaSize) } : {}),
      ...(mediaType === "video"
        ? { durationSeconds: Number(durationSeconds) }
        : {}),
      privacy: privacy || "friends",
      ...(prompt ? { prompt } : {}),
      ...(caption ? { text: caption } : {}),
      createdAt,
      expiresAt: new Date(createdAt.getTime() + STORY_LIFETIME_MS),
      viewers: [],
    });

    return res.status(201).json(story);
  } catch (error) {
    console.error("Error creating Story", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getStories(req, res) {
  try {
    const visibleUserQuery = {
      $in: getVisibleUserIds(req.user),
      ...(req.user.hiddenStoryUsers?.length
        ? { $nin: req.user.hiddenStoryUsers }
        : {}),
    };
    const stories = await Story.find({
      user: visibleUserQuery,
      expiresAt: { $gt: new Date() },
      $or: [{ user: req.user._id }, { privacy: { $ne: "only_me" } }],
    })
      .populate("user", "fullName profilePic")
      .sort({ createdAt: 1 });

    const sanitizedStories = stories.map((story) =>
      sanitizeStoryForUser(story.toObject(), req.user._id),
    );

    return res.status(200).json(sanitizedStories);
  } catch (error) {
    console.error("Error getting Stories", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function viewStory(req, res) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid Story ID" });
  }

  try {
    const story = await Story.findById(id);

    if (!story) {
      return res.status(404).json({ message: "Story not found" });
    }

    if (story.expiresAt <= new Date()) {
      return res.status(410).json({ message: "Story has expired" });
    }

    if (!isVisibleToUser(story, req.user)) {
      return res
        .status(403)
        .json({ message: "You are not authorized to view this Story" });
    }

    if (story.user.toString() === req.user._id.toString()) {
      return res
        .status(200)
        .json(sanitizeStoryForUser(story.toObject(), req.user._id));
    }

    const updatedStory = await Story.findOneAndUpdate(
      { _id: id, expiresAt: { $gt: new Date() } },
      { $addToSet: { viewers: req.user._id } },
      { new: true },
    );

    if (!updatedStory) {
      return res.status(410).json({ message: "Story has expired" });
    }

    return res
      .status(200)
      .json(sanitizeStoryForUser(updatedStory.toObject(), req.user._id));
  } catch (error) {
    console.error("Error viewing Story", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getStoryViewers(req, res) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid Story ID" });
  }

  try {
    const story = await Story.findById(id);

    if (!story) {
      return res.status(404).json({ message: "Story not found" });
    }

    if (story.expiresAt <= new Date()) {
      return res.status(410).json({ message: "Story has expired" });
    }

    if (story.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "You are not authorized to view the viewer list of this Story",
      });
    }

    const populatedStory = await Story.findById(id).populate(
      "viewers",
      "fullName profilePic nativeLanguage learningLanguage",
    );

    return res.status(200).json(populatedStory.viewers || []);
  } catch (error) {
    console.error("Error getting Story viewers", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function deleteStory(req, res) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid Story ID" });
  }

  try {
    const story = await Story.findById(id);

    if (!story) {
      return res.status(404).json({ message: "Story not found" });
    }

    if (story.user.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "You are not authorized to delete this Story" });
    }

    // Attempt to clean up media, but don't fail the entire delete if media cleanup fails
    if (story.mediaUrl) {
      try {
        await deleteStreamStoryMedia(story.mediaUrl, story.mediaType);
      } catch (error) {
        // Log media deletion error but continue with Story deletion from DB
        console.error(
          "Warning: Could not delete Story media from Stream CDN",
          error.message,
        );
        // Do not return error here - Story still needs to be removed from DB
      }
    }

    // Delete Story from database
    const deleteResult = await Story.deleteOne({ _id: story._id });

    if (deleteResult.deletedCount === 0) {
      return res.status(404).json({ message: "Story not found" });
    }

    return res.status(200).json({ success: true, message: "Story deleted" });
  } catch (error) {
    console.error("Error deleting Story", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

const SUPPORTED_REACTIONS = ["❤️", "😂", "😮", "😢", "🔥", "👍"];

const buildReactionResponse = (story, userId, isOwner) => {
  // Only return reaction analytics to the story owner
  if (!isOwner) {
    return {
      storyId: story._id,
      reactions: [],
      myReaction:
        (story.reactions || []).find(
          (r) => r.user.toString() === userId.toString(),
        )?.type || null,
    };
  }

  // Owner sees full reaction analytics
  const reactions = story.reactions || [];
  const counts = SUPPORTED_REACTIONS.reduce((acc, type) => {
    const count = reactions.filter((r) => r.type === type).length;
    if (count > 0) acc.push({ type, count });
    return acc;
  }, []);
  const myReaction =
    reactions.find((r) => r.user.toString() === userId.toString())?.type ||
    null;
  return {
    storyId: story._id,
    reactions: counts,
    myReaction,
  };
};

export async function addReaction(req, res) {
  const { id } = req.params;
  const { type } = req.body || {};

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid Story ID" });
  }

  if (!SUPPORTED_REACTIONS.includes(type)) {
    return res.status(400).json({
      message: `Invalid reaction type. Supported: ${SUPPORTED_REACTIONS.join(", ")}`,
    });
  }

  try {
    const story = await Story.findById(id);

    if (!story) {
      return res.status(404).json({ message: "Story not found" });
    }

    if (story.expiresAt <= new Date()) {
      return res.status(410).json({ message: "Story has expired" });
    }

    if (!isVisibleToUser(story, req.user)) {
      return res
        .status(403)
        .json({ message: "You are not authorized to react to this Story" });
    }

    const userId = req.user._id;
    const isOwner = story.user.toString() === userId.toString();

    const finalStory = await Story.findOneAndUpdate(
      { _id: id, expiresAt: { $gt: new Date() } },
      [
        {
          $set: {
            reactions: {
              $concatArrays: [
                {
                  $filter: {
                    input: { $ifNull: ["$reactions", []] },
                    as: "reaction",
                    cond: { $ne: ["$$reaction.user", userId] },
                  },
                },
                [{ user: userId, type }],
              ],
            },
          },
        },
      ],
      { new: true },
    );

    if (!finalStory) {
      return res.status(410).json({ message: "Story has expired" });
    }

    // Notify story owner — but never notify the actor themselves
    if (!isOwner) {
      try {
        await createNotification({
          recipient: finalStory.user,
          actor: userId,
          type: "story_reaction",
          story: finalStory._id,
          reactionType: type,
        });
      } catch (notifError) {
        // Notification failure must never break the reaction response
        console.error(
          "Error creating reaction notification",
          notifError.message,
        );
      }
    }

    return res
      .status(200)
      .json(buildReactionResponse(finalStory, userId, isOwner));
  } catch (error) {
    console.error("Error adding Story reaction", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function removeReaction(req, res) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid Story ID" });
  }

  try {
    const story = await Story.findById(id);

    if (!story) {
      return res.status(404).json({ message: "Story not found" });
    }

    if (story.expiresAt <= new Date()) {
      return res.status(410).json({ message: "Story has expired" });
    }

    if (!isVisibleToUser(story, req.user)) {
      return res.status(403).json({
        message: "You are not authorized to interact with this Story",
      });
    }

    const userId = req.user._id;
    const isOwner = story.user.toString() === userId.toString();

    const updatedStory = await Story.findOneAndUpdate(
      { _id: id, expiresAt: { $gt: new Date() } },
      { $pull: { reactions: { user: userId } } },
      { new: true },
    );

    if (!updatedStory) {
      return res.status(410).json({ message: "Story has expired" });
    }

    return res
      .status(200)
      .json(buildReactionResponse(updatedStory, userId, isOwner));
  } catch (error) {
    console.error("Error removing Story reaction", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getHiddenStoryUsers(req, res) {
  try {
    const user = await User.findById(req.user._id).populate(
      "hiddenStoryUsers",
      "fullName profilePic",
    );
    return res.status(200).json(user?.hiddenStoryUsers || []);
  } catch (error) {
    console.error("Error loading hidden Story users", error.message);
    return res.status(500).json({ message: "Unable to load hidden Stories" });
  }
}

export async function hideStoriesFromUser(req, res) {
  const { userId } = req.params;
  if (!mongoose.isValidObjectId(userId) || userId === req.user._id.toString()) {
    return res.status(400).json({ message: "Invalid user to hide" });
  }

  try {
    const targetExists = await User.exists({ _id: userId });
    if (!targetExists)
      return res.status(404).json({ message: "User not found" });

    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { hiddenStoryUsers: userId },
    });
    return res.status(200).json({ success: true, hiddenUserId: userId });
  } catch (error) {
    console.error("Error hiding Story user", error.message);
    return res.status(500).json({ message: "Unable to hide Stories" });
  }
}

export async function unhideStoriesFromUser(req, res) {
  const { userId } = req.params;
  if (!mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ message: "Invalid user to unhide" });
  }

  try {
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { hiddenStoryUsers: userId },
    });
    return res.status(200).json({ success: true, unhiddenUserId: userId });
  } catch (error) {
    console.error("Error unhiding Story user", error.message);
    return res.status(500).json({ message: "Unable to unhide Stories" });
  }
}

export async function reportStory(req, res) {
  const { id } = req.params;
  const { reason } = req.body || {};
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid Story ID" });
  }
  if (!STORY_REPORT_REASONS.includes(reason)) {
    return res.status(400).json({ message: "Choose a valid report reason" });
  }

  try {
    const story = await Story.findById(id);
    if (!story || story.expiresAt <= new Date()) {
      return res.status(404).json({ message: "Story is unavailable" });
    }
    if (story.user.toString() === req.user._id.toString()) {
      return res
        .status(400)
        .json({ message: "You cannot report your own Story" });
    }
    if (!isVisibleToUser(story, req.user)) {
      return res.status(403).json({ message: "You cannot report this Story" });
    }

    const reportedStory = await Story.findOneAndUpdate(
      {
        _id: id,
        expiresAt: { $gt: new Date() },
        reports: { $not: { $elemMatch: { user: req.user._id } } },
      },
      {
        $push: {
          reports: { user: req.user._id, reason, createdAt: new Date() },
        },
      },
      { new: true },
    );

    if (!reportedStory) {
      return res
        .status(409)
        .json({ message: "You already reported this Story" });
    }

    return res.status(201).json({ success: true });
  } catch (error) {
    console.error("Error reporting Story", error.message);
    return res.status(500).json({ message: "Unable to report this Story" });
  }
}
