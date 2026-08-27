import mongoose from "mongoose";
import Story from "../models/Story.js";
import User from "../models/User.js";
import { areStreamChannelMembers, verifyStreamWebhook } from "../lib/stream.js";
import { createNotification } from "../services/notification.service.js";

const getStreamId = (value) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

export async function handleStreamWebhook(req, res) {
  const signature = req.get("x-signature");
  const rawBody = req.body;

  if (!signature || !Buffer.isBuffer(rawBody)) {
    return res.status(400).json({ message: "Invalid webhook request" });
  }

  try {
    if (!verifyStreamWebhook(rawBody, signature)) {
      return res.status(401).json({ message: "Invalid webhook signature" });
    }

    const event = JSON.parse(rawBody.toString("utf8"));
    if (event.type !== "message.new") {
      return res.status(200).json({ received: true });
    }

    const message = event.message || {};
    const storyId = getStreamId(message.story_id);
    const messageId = getStreamId(message.id);
    const senderId = getStreamId(event.user?.id || message.user?.id);
    const channelId = getStreamId(
      event.channel_id || event.channel?.id || message.cid?.split(":")[1],
    );
    const channelType = getStreamId(
      event.channel_type || event.channel?.type || message.cid?.split(":")[0],
    );

    if (
      !storyId ||
      !messageId ||
      !senderId ||
      !channelId ||
      !channelType ||
      !mongoose.isValidObjectId(storyId) ||
      !mongoose.isValidObjectId(senderId)
    ) {
      return res.status(200).json({ received: true });
    }

    const [story, sender] = await Promise.all([
      Story.findOne({ _id: storyId, expiresAt: { $gt: new Date() } }),
      User.findById(senderId).select("_id"),
    ]);

    if (!story || !sender) return res.status(200).json({ received: true });

    const recipientId = story.user.toString();
    if (recipientId === senderId)
      return res.status(200).json({ received: true });

    const channelHasParticipants = await areStreamChannelMembers({
      channelType,
      channelId,
      userIds: [senderId, recipientId],
    });

    if (!channelHasParticipants) {
      return res.status(403).json({ message: "Invalid story reply channel" });
    }

    await createNotification({
      recipient: story.user,
      actor: sender._id,
      type: "story_reply",
      story: story._id,
      messageId,
      reactionType: null,
    });

    return res.status(200).json({ received: true });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(200).json({ received: true });
    }

    console.error("Error handling Stream webhook", error.message);
    return res.status(500).json({ message: "Webhook processing failed" });
  }
}
