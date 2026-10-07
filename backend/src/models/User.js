import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    bio: {
      type: String,
      default: "",
    },
    profilePic: {
      type: String,
      default: "",
    },
    nativeLanguage: {
      type: String,
      default: "",
    },
    learningLanguage: {
      type: String,
      default: "",
    },
    interests: {
      type: [{ type: String, trim: true, maxlength: 40 }],
      default: [],
    },
    location: {
      type: String,
      default: "",
    },
    isOnboarded: {
      type: Boolean,
      default: false,
    },
    emailVerified: {
      type: Boolean,
      default: true,
    },
    emailVerificationOTPHash: {
      type: String,
      default: null,
    },
    emailVerificationExpiresAt: {
      type: Date,
      default: null,
    },
    emailVerificationAttempts: {
      type: Number,
      default: 0,
    },
    emailVerificationLastSentAt: {
      type: Date,
      default: null,
    },
    emailVerificationResendCount: {
      type: Number,
      default: 0,
    },
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    hiddenStoryUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    savedMarketplaceListings: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MarketplaceListing",
      },
    ],
    isMarketplaceModerator: {
      type: Boolean,
      default: false,
    },
    notificationPreferences: {
      messages: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: false },
      },
      friendRequests: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: false },
      },
      storyReactions: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: false },
      },
      storyReplies: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: false },
      },
      communityActivity: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: false },
      },
      calls: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: false },
      },
      marketplace: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: false },
      },
      mentions: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: false },
      },
      languagePartnerActivity: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: false },
      },
    },
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

userSchema.index({ fullName: 1 });
userSchema.index({ blockedUsers: 1 });
userSchema.index({
  fullName: "text",
  nativeLanguage: "text",
  learningLanguage: "text",
  interests: "text",
});

//pre hook
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  const isPasswordCorrect = await bcrypt.compare(
    enteredPassword,
    this.password,
  );

  return isPasswordCorrect;
};

const User = mongoose.model("User", userSchema);

export default User;
