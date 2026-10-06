import mongoose from "mongoose";

const storySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    mediaUrl: {
      type: String,
      required: true,
      trim: true,
    },
    mediaType: {
      type: String,
      required: true,
      enum: ["image", "video"],
    },
    mediaSize: {
      type: Number,
      required: true,
      min: 0,
      max: 10 * 1024 * 1024,
    },
    durationSeconds: {
      type: Number,
      min: 0,
      max: 60.5,
    },
    privacy: {
      type: String,
      enum: ["friends", "only_me"],
      default: "friends",
    },
    prompt: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    text: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    reports: [
      {
        _id: false,
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        reason: {
          type: String,
          enum: ["spam", "inappropriate", "harassment", "other"],
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    viewers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    reactions: [
      {
        _id: false,
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        type: {
          type: String,
          required: true,
          enum: ["❤️", "😂", "😮", "😢", "🔥", "👍"],
        },
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

storySchema.index({ user: 1, expiresAt: 1 });
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Story = mongoose.model("Story", storySchema);

export default Story;
