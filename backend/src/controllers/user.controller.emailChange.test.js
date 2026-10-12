import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import mongoose from "mongoose";
import { StreamChat } from "stream-chat";

process.env.STREAM_API_KEY ||= "test-stream-key";
process.env.STREAM_API_SECRET ||= "test-stream-secret";

const [{ default: User }, userController] = await Promise.all([
  import("../models/User.js"),
  import("./user.controller.js"),
]);

const userId = new mongoose.Types.ObjectId("64a000000000000000000031");

const makeResponse = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

afterEach(() => mock.restoreAll());

test("changing profile email invalidates verification and clears stale OTP state", async () => {
  let update;
  const updatedUser = {
    _id: userId,
    fullName: "Email learner",
    email: "new@example.test",
    emailVerified: false,
    bio: "",
    profilePic: "",
    location: "",
    interests: [],
    socialLinks: {},
    notificationPreferences: {},
  };
  mock.method(User, "findOne", async () => null);
  mock.method(User, "findByIdAndUpdate", async (_id, nextUpdate) => {
    update = nextUpdate;
    return updatedUser;
  });
  mock.method(StreamChat.prototype, "upsertUsers", async () => ({}));

  const res = makeResponse();
  await userController.updateMyProfile(
    {
      user: {
        _id: userId,
        fullName: "Email learner",
        email: "old@example.test",
        emailVerified: true,
        bio: "",
        profilePic: "",
        location: "",
        interests: [],
        socialLinks: {},
      },
      body: { email: "new@example.test" },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(update.email, "new@example.test");
  assert.equal(update.emailVerified, false);
  assert.equal(update.emailVerificationOTPHash, null);
  assert.equal(update.emailVerificationExpiresAt, null);
  assert.equal(update.emailVerificationAttempts, 0);
  assert.equal(update.emailVerificationLastSentAt, null);
  assert.equal(update.emailVerificationResendCount, 0);
  assert.equal(res.body.user.emailVerified, false);
});
