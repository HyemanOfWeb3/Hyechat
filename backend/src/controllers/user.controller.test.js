import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import mongoose from "mongoose";

process.env.STREAM_API_KEY ||= "test-stream-key";
process.env.STREAM_API_SECRET ||= "test-stream-secret";

const [{ default: User }, userController] = await Promise.all([
  import("../models/User.js"),
  import("./user.controller.js"),
]);

const originalClientUrl = process.env.CLIENT_URL;
const PROFILE_ID = new mongoose.Types.ObjectId("64a000000000000000000099");

const response = () => ({
  statusCode: null,
  body: null,
  headers: {},
  status(code) {
    this.statusCode = code;
    return this;
  },
  setHeader(name, value) {
    this.headers[name.toLowerCase()] = value;
  },
  json(body) {
    this.body = body;
    return this;
  },
  send(body) {
    this.body = body;
    return this;
  },
});

afterEach(() => {
  mock.restoreAll();
  if (originalClientUrl === undefined) delete process.env.CLIENT_URL;
  else process.env.CLIENT_URL = originalClientUrl;
});

test("public profile returns an allowlist and canonical safe social links", async () => {
  const user = {
    _id: PROFILE_ID,
    fullName: "Public learner",
    profilePic: "https://cdn.example.test/avatar.png",
    bio: "Practising English",
    nativeLanguage: "yoruba",
    learningLanguage: "english",
    interests: ["music"],
    location: "Lagos",
    emailVerified: true,
    isOnboarded: true,
    friends: [],
    blockedUsers: [],
    socialLinks: {
      x: "https://evil.example.test/profile",
      instagram: "http://www.instagram.com/learner/",
      facebook: null,
      tiktok: "https://www.tiktok.com/@learner",
    },
    email: "private@example.test",
    password: "must-not-leak",
  };
  mock.method(User, "findById", () => ({ select: async () => user }));

  const res = response();
  await userController.getPublicUserProfile(
    { params: { userId: PROFILE_ID.toString() }, user: null },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(Object.keys(res.body.profile).sort(), [
    "_id",
    "bio",
    "emailVerified",
    "fullName",
    "interests",
    "learningLanguage",
    "location",
    "nativeLanguage",
    "profilePic",
    "relationship",
    "socialLinks",
  ]);
  assert.equal(res.body.profile.socialLinks.x, null);
  assert.equal(
    res.body.profile.socialLinks.instagram,
    "https://instagram.com/learner",
  );
  assert.equal(
    res.body.profile.socialLinks.tiktok,
    "https://tiktok.com/@learner",
  );
  assert.equal(
    JSON.stringify(res.body).includes("private@example.test"),
    false,
  );
  assert.equal(JSON.stringify(res.body).includes("must-not-leak"), false);
});

test("profile metadata escapes user text and validates canonical/image URLs", async () => {
  process.env.CLIENT_URL =
    "https://profiles.example.test/app-path,https://unused.example.test";
  const user = {
    _id: PROFILE_ID,
    fullName: 'A <script>alert("x")</script>',
    bio: "Bio & <img src=x onerror=alert(1)>",
    profilePic: 'javascript:alert("image")',
    isOnboarded: true,
  };
  mock.method(User, "findById", () => ({ select: async () => user }));

  const res = response();
  await userController.getProfileOpenGraph(
    { params: { userId: PROFILE_ID.toString() } },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["content-type"], "text/html; charset=utf-8");
  assert.match(res.body, /https:\/\/profiles\.example\.test\/profile\//);
  assert.match(res.body, /https:\/\/profiles\.example\.test\/api\/og\/image\//);
  assert.match(
    res.body,
    /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/,
  );
  assert.match(res.body, /Bio &amp; &lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(res.body, /javascript:alert/);
  assert.doesNotMatch(res.body, /<script>alert/);
  assert.match(res.body, /<meta name="twitter:image"/);
});

test("share image shows only onboarded profile claims and actual language/verification data", async () => {
  process.env.CLIENT_URL = "https://profiles.example.test";
  const user = {
    fullName: "Learner & friend",
    bio: "",
    nativeLanguage: "",
    learningLanguage: "",
    emailVerified: false,
  };
  mock.method(User, "findOne", (filter) => {
    assert.equal(String(filter._id), PROFILE_ID.toString());
    assert.equal(filter.isOnboarded, true);
    return { select: async () => user };
  });

  const res = response();
  await userController.getProfileShareImage(
    { params: { userId: PROFILE_ID.toString() } },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["content-type"], "image/svg+xml; charset=utf-8");
  assert.match(res.body, /Learner &amp; friend/);
  assert.doesNotMatch(res.body, /EMAIL VERIFIED/);
  assert.doesNotMatch(res.body, />English</);
  assert.doesNotMatch(res.body, /Connect and exchange languages/);
});
