import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

process.env.STREAM_API_KEY ||= "test-stream-key";
process.env.STREAM_API_SECRET ||= "test-stream-secret";

const { onboard } = await import("./auth.controller.js");

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

const makeRequest = (body = {}) => ({
  body: {
    fullName: "Onboarding learner",
    bio: "Ready to learn",
    nativeLanguage: "armenian",
    learningLanguage: "english",
    location: "Yerevan",
    ...body,
  },
  user: {
    _id: new mongoose.Types.ObjectId("64a000000000000000000021"),
    emailVerified: true,
    profilePic: "https://cdn.example.test/existing.png",
  },
});

const makeDependencies = (updatedUser) => {
  const calls = { updates: [], streamUsers: [] };
  return {
    calls,
    userModel: {
      findByIdAndUpdate: async (userId, updates, options) => {
        calls.updates.push({ userId, updates, options });
        return { ...updatedUser, ...updates };
      },
    },
    upsertUser: async (user) => calls.streamUsers.push(user),
  };
};

test("onboarding without a picture preserves the existing profile picture", async () => {
  const dependencies = makeDependencies({
    _id: makeRequest().user._id,
    profilePic: "https://cdn.example.test/existing.png",
  });
  const res = makeResponse();

  await onboard(makeRequest(), res, dependencies);

  assert.equal(res.statusCode, 200);
  assert.equal(Object.hasOwn(dependencies.calls.updates[0].updates, "profilePic"), false);
  assert.equal(res.body.user.profilePic, "https://cdn.example.test/existing.png");
  assert.equal(
    dependencies.calls.streamUsers[0].image,
    "https://cdn.example.test/existing.png",
  );
});

test("onboarding accepts a valid uploaded profile-picture URL", async () => {
  const profilePic = "https://cdn.stream-io-cdn.com/users/avatar.png";
  const dependencies = makeDependencies({ _id: makeRequest().user._id });
  const res = makeResponse();

  await onboard(makeRequest({ profilePic }), res, dependencies);

  assert.equal(res.statusCode, 200);
  assert.equal(dependencies.calls.updates[0].updates.profilePic, profilePic);
  assert.equal(dependencies.calls.streamUsers[0].image, profilePic);
});

test("onboarding rejects malformed, unsafe, or non-Stream picture references before persistence", async () => {
  for (const profilePic of [
    null,
    42,
    "javascript:alert(1)",
    "data:image/png;base64,abc",
    "https://untrusted.example.test/photo.png",
    "http://cdn.stream-io-cdn.com/photo.png",
  ]) {
    const dependencies = makeDependencies({ _id: makeRequest().user._id });
    const res = makeResponse();

    await onboard(makeRequest({ profilePic }), res, dependencies);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /Stream image URL|valid image URL/);
    assert.equal(dependencies.calls.updates.length, 0);
    assert.equal(dependencies.calls.streamUsers.length, 0);
  }
});

test("an explicitly empty picture URL removes the profile photo", async () => {
  const dependencies = makeDependencies({ _id: makeRequest().user._id });
  const res = makeResponse();

  await onboard(makeRequest({ profilePic: "  " }), res, dependencies);

  assert.equal(res.statusCode, 200);
  assert.equal(dependencies.calls.updates[0].updates.profilePic, "");
  assert.equal(dependencies.calls.streamUsers[0].image, "");
});

test("unverified users remain blocked from onboarding", async () => {
  const request = makeRequest({ profilePic: "https://cdn.example.test/photo.png" });
  request.user.emailVerified = false;
  const dependencies = makeDependencies({});
  const res = makeResponse();

  await onboard(request, res, dependencies);

  assert.equal(res.statusCode, 403);
  assert.equal(dependencies.calls.updates.length, 0);
});
