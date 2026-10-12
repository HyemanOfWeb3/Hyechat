import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

process.env.JWT_SECRET_KEY ||= "test-session-version-secret";

const [{ default: User }, authMiddleware] = await Promise.all([
  import("../models/User.js"),
  import("./auth.middleware.js"),
]);

const userId = new mongoose.Types.ObjectId("64a000000000000000000041");
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
const tokenForVersion = (tokenVersion) =>
  jwt.sign(
    { userId: userId.toString(), ...(tokenVersion === undefined ? {} : { tokenVersion }) },
    process.env.JWT_SECRET_KEY,
    { expiresIn: "5m" },
  );

afterEach(() => mock.restoreAll());

test("protected routes accept a token matching the current session version", async () => {
  const user = { _id: userId, tokenVersion: 2 };
  mock.method(User, "findById", () => ({ select: async () => user }));
  const req = { cookies: { jwt: tokenForVersion(2) } };
  const res = makeResponse();
  let nextCalled = false;

  await authMiddleware.protectRoute(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.user, user);
});

test("protected routes reject tokens issued before a password change", async () => {
  mock.method(User, "findById", () => ({ select: async () => ({ _id: userId, tokenVersion: 3 }) }));
  const res = makeResponse();
  let nextCalled = false;

  await authMiddleware.protectRoute(
    { cookies: { jwt: tokenForVersion(2) } },
    res,
    () => {
      nextCalled = true;
    },
  );

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.message, "Unauthorized - Session expired");
});

test("legacy tokens remain valid for unchanged version-zero accounts only", async () => {
  mock.method(User, "findById", () => ({ select: async () => ({ _id: userId, tokenVersion: 0 }) }));
  const req = { cookies: { jwt: tokenForVersion(undefined) } };
  let nextCalled = false;

  await authMiddleware.protectRoute(req, makeResponse(), () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  mock.restoreAll();
  mock.method(User, "findById", () => ({ select: async () => ({ _id: userId, tokenVersion: 1 }) }));
  const res = makeResponse();
  nextCalled = false;
  await authMiddleware.protectRoute(
    { cookies: { jwt: tokenForVersion(undefined) } },
    res,
    () => {
      nextCalled = true;
    },
  );
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test("optional auth ignores revoked sessions instead of treating them as logged in", async () => {
  mock.method(User, "findById", () => ({ select: async () => ({ _id: userId, tokenVersion: 4 }) }));
  const req = { cookies: { jwt: tokenForVersion(3) } };

  await authMiddleware.optionalProtectRoute(req, makeResponse(), () => {});

  assert.equal(req.user, null);
});
