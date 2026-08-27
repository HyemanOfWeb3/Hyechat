import mongoose from "mongoose";
import Story from "../models/Story.js";
import { deleteStreamImage } from "../lib/stream.js";
import { createNotification } from "../services/notification.service.js";

const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;
const MAX_MEDIA_URL_LENGTH = 2048;
const STREAM_CDN_HOST_SUFFIX = "stream-io-cdn.com";

const getVisibleUserIds = (user) => [
  user._id,
  ...(Array.isArray(user.friends) ? user.friends : []),
];

const isVisibleToUser = (story, user) =>
  getVisibleUserIds(user).some(
    (userId) => userId.toString() === story.user.toString(),
  );

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
  const { mediaUrl, mediaType } = req.body || {};

  if (!mediaUrl) {
    return res.status(400).json({ message: "Story media URL is required" });
  }

  if (mediaType !== "image") {
    return res
      .status(400)
      .json({ message: "Only image stories are supported" });
  }

  if (!isValidStreamImageUrl(mediaUrl)) {
    return res.status(400).json({ message: "Invalid Story media URL" });
  }

  try {
    const createdAt = new Date();
    const story = await Story.create({
      user: req.user._id,
      mediaUrl: mediaUrl.trim(),
      mediaType,
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
    const stories = await Story.find({
      user: { $in: getVisibleUserIds(req.user) },
      expiresAt: { $gt: new Date() },
    })
      .populate("user", "fullName profilePic")
      .sort({ createdAt: 1 });

    const sanitizedStories = stories.map((story) => {
      const storyObj = story.toObject();
      const ownerId = storyObj.user._id || storyObj.user;
      if (ownerId.toString() !== req.user._id.toString()) {
        delete storyObj.viewers;
      }
      return storyObj;
    });

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
      return res.status(200).json(story);
    }

    const updatedStory = await Story.findOneAndUpdate(
      { _id: id, expiresAt: { $gt: new Date() } },
      { $addToSet: { viewers: req.user._id } },
      { new: true },
    );

    if (!updatedStory) {
      return res.status(410).json({ message: "Story has expired" });
    }

    const storyObj = updatedStory.toObject();
    if (storyObj.user.toString() !== req.user._id.toString()) {
      delete storyObj.viewers;
    }

    return res.status(200).json(storyObj);
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
      return res
        .status(403)
        .json({
          message:
            "You are not authorized to view the viewer list of this Story",
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

    try {
      await deleteStreamImage(story.mediaUrl);
    } catch (error) {
      console.error("Error deleting Story media", error.message);
      return res.status(502).json({ message: "Unable to delete Story media" });
    }

    await Story.deleteOne({ _id: story._id });

    return res.status(200).json({ success: true, message: "Story deleted" });
  } catch (error) {
    console.error("Error deleting Story", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

const SUPPORTED_REACTIONS = ["❤️", "😂", "😮", "😢", "🔥", "👍"];

const buildReactionResponse = (story, userId) => {
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

    // Atomically remove any existing reaction from this user then add the new one
    const updatedStory = await Story.findOneAndUpdate(
      { _id: id, expiresAt: { $gt: new Date() } },
      {
        $pull: { reactions: { user: userId } },
      },
      { new: false },
    );

    if (!updatedStory) {
      return res.status(410).json({ message: "Story has expired" });
    }

    const finalStory = await Story.findOneAndUpdate(
      { _id: id, expiresAt: { $gt: new Date() } },
      {
        $push: { reactions: { user: userId, type } },
      },
      { new: true },
    );

    if (!finalStory) {
      return res.status(410).json({ message: "Story has expired" });
    }

    // Notify story owner — but never notify the actor themselves
    if (finalStory.user.toString() !== userId.toString()) {
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
        console.error("Error creating reaction notification", notifError.message);
      }
    }

    return res.status(200).json(buildReactionResponse(finalStory, userId));
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
      return res
        .status(403)
        .json({
          message: "You are not authorized to interact with this Story",
        });
    }

    const userId = req.user._id;

    const updatedStory = await Story.findOneAndUpdate(
      { _id: id, expiresAt: { $gt: new Date() } },
      { $pull: { reactions: { user: userId } } },
      { new: true },
    );

    if (!updatedStory) {
      return res.status(410).json({ message: "Story has expired" });
    }

    return res.status(200).json(buildReactionResponse(updatedStory, userId));
  } catch (error) {
    console.error("Error removing Story reaction", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
