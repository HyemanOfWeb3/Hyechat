import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET_KEY ||= "test-session-version-secret";
process.env.STREAM_API_KEY ||= "test-stream-key";
process.env.STREAM_API_SECRET ||= "test-stream-secret";

const [{ default: User }, userController, authController] = await Promise.all([
  import("../models/User.js"),
  import("./user.controller.js"),
  import("./auth.controller.js"),
]);

const userId = "64a000000000000000000042";
const makeResponse = () => ({
  statusCode: null,
  body: null,
  cookies: {},
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
  cookie(name, value, options) {
    this.cookies[name] = { value, options };
    return this;
  },
});

afterEach(() => mock.restoreAll());

test("changing a password increments the session version and rotates the current cookie", async () => {
  const user = {
    _id: userId,
    tokenVersion: 4,
    matchPassword: async (password) => password === "current-password",
    save: async () => {},
  };
  mock.method(User, "findById", async () => user);
  const res = makeResponse();

  await userController.changeMyPassword(
    {
      user: { _id: userId },
      body: {
        currentPassword: "current-password",
        newPassword: "new-password",
        confirmPassword: "new-password",
      },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(user.tokenVersion, 5);
  assert.equal(
    jwt.verify(res.cookies.jwt.value, process.env.JWT_SECRET_KEY).tokenVersion,
    5,
  );
  assert.equal(res.cookies.jwt.options.httpOnly, true);
  assert.equal(res.cookies.jwt.options.sameSite, "lax");
});

test("password reset increments the session version and clears reset credentials", async () => {
  const resetToken = "test-only-reset-token";
  const user = {
    _id: userId,
    tokenVersion: 2,
    resetPasswordToken: crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex"),
    resetPasswordExpires: new Date(Date.now() + 60_000),
    save: async () => {},
  };
  mock.method(User, "findOne", async (filter) => {
    assert.equal(filter.resetPasswordToken, user.resetPasswordToken);
    return user;
  });
  const res = makeResponse();

  await authController.resetPassword(
    { params: { token: resetToken }, body: { password: "new-password" } },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(user.tokenVersion, 3);
  assert.equal(user.resetPasswordToken, null);
  assert.equal(user.resetPasswordExpires, null);
});
