import mongoose from "mongoose";

const memberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["owner", "admin", "member"],
      default: "member",
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const communitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    avatar: {
      type: String,
      default: "",
      trim: true,
    },
    category: {
      type: String,
      default: "",
      trim: true,
      maxlength: 50,
    },
    rules: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    privacy: {
      type: String,
      enum: ["private", "public"],
      default: "private",
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: {
      type: [memberSchema],
      default: [],
    },
    streamChannelId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
    },
    inviteTokenHash: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },
    inviteEnabled: {
      type: Boolean,
      default: true,
    },
    inviteCreatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

communitySchema.index({ "members.user": 1 });
communitySchema.index({ owner: 1, createdAt: -1 });

const Community = mongoose.model("Community", communitySchema);

export default Community;
