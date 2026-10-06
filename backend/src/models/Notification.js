import mongoose from "mongoose";

const NOTIFICATION_TYPES = [
  "message",
  "story_reaction",
  "story_reply",
  "friend_request",
  "friend_accepted",
  "friend_declined",
  "friend_cancelled",
  "friend_removed",
  "community_activity",
  "call",
  "marketplace",
  "mention",
  "language_partner_activity",
];

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: NOTIFICATION_TYPES,
    },
    story: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Story",
      default: null,
    },
    // Only set for story_reaction
    reactionType: {
      type: String,
      enum: ["❤️", "😂", "😮", "😢", "🔥", "👍", null],
      default: null,
    },
    // Only set for story_reply
    messageId: {
      type: String,
      default: null,
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

// Support querying all notifications for a recipient, newest first
notificationSchema.index({ recipient: 1, createdAt: -1 });

// Support querying unread notifications for a recipient, newest first
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

// Stream retries must not create duplicate story-reply notifications
notificationSchema.index(
  { type: 1, messageId: 1 },
  { unique: true, partialFilterExpression: { messageId: { $type: "string" } } },
);

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
