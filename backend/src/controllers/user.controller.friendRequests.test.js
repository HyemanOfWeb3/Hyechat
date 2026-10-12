import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import mongoose from "mongoose";

process.env.STREAM_API_KEY ||= "test-stream-key";
process.env.STREAM_API_SECRET ||= "test-stream-secret";

const [
  { default: User },
  { default: FriendRequest },
  userController,
] = await Promise.all([
  import("../models/User.js"),
  import("../models/FriendRequest.js"),
  import("./user.controller.js"),
]);

const senderId = new mongoose.Types.ObjectId("64a000000000000000000021");
const recipientId = new mongoose.Types.ObjectId(
  "64a000000000000000000022",
);

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

const makeUserQuery = (user) => ({
  select: async () => user,
  then: (resolve, reject) => Promise.resolve(user).then(resolve, reject),
});

afterEach(() => mock.restoreAll());

test("a declined historical request does not prevent a new request", async () => {
  const newRequest = {
    _id: new mongoose.Types.ObjectId("64a000000000000000000023"),
    sender: senderId,
    recipient: recipientId,
    status: "pending",
  };
  let existingRequestFilter;
  const recipient = {
    _id: recipientId,
    blockedUsers: [],
    friends: [],
    notificationPreferences: { friendRequests: { inApp: false } },
  };
  mock.method(User, "findById", () => makeUserQuery(recipient));
  mock.method(FriendRequest, "findOne", async (filter) => {
    existingRequestFilter = filter;
    return null;
  });
  mock.method(FriendRequest, "create", async (payload) => {
    assert.equal(String(payload.sender), String(senderId));
    assert.equal(String(payload.recipient), String(recipientId));
    return newRequest;
  });
  const res = makeResponse();
  await userController.sendFriendRequest(
    {
      user: { id: String(senderId), _id: senderId, blockedUsers: [] },
      params: { id: String(recipientId) },
    },
    res,
  );

  assert.equal(existingRequestFilter.status, "pending");
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.relationship.status, "pending_outgoing");
});

test("only a pending friend request can be accepted", async () => {
  const rejectedRequest = {
    _id: new mongoose.Types.ObjectId("64a000000000000000000024"),
    sender: senderId,
    recipient: recipientId,
    status: "rejected",
  };
  let acceptanceFilter;
  mock.method(FriendRequest, "findById", async () => rejectedRequest);
  mock.method(FriendRequest, "findOneAndUpdate", async (filter) => {
    acceptanceFilter = filter;
    return null;
  });
  mock.method(User, "findByIdAndUpdate", async () => null);
  mock.method(User, "findById", () =>
    makeUserQuery({ notificationPreferences: { friendRequests: { inApp: false } } }),
  );

  const res = makeResponse();
  await userController.acceptFriendRequest(
    {
      params: { id: String(rejectedRequest._id) },
      user: { id: String(recipientId), _id: recipientId },
    },
    res,
  );

  assert.equal(acceptanceFilter.status, "pending");
  assert.equal(res.statusCode, 409);
  assert.equal(rejectedRequest.status, "rejected");
});

test("a pending friend request is atomically accepted", async () => {
  const pendingRequest = {
    _id: new mongoose.Types.ObjectId("64a000000000000000000025"),
    sender: senderId,
    recipient: recipientId,
    status: "pending",
  };
  let acceptanceFilter;
  mock.method(FriendRequest, "findById", async () => pendingRequest);
  mock.method(FriendRequest, "findOneAndUpdate", async (filter, update, options) => {
    acceptanceFilter = filter;
    assert.deepEqual(update, { $set: { status: "accepted" } });
    assert.equal(options.new, true);
    return { ...pendingRequest, status: "accepted" };
  });
  mock.method(User, "findByIdAndUpdate", async () => null);
  mock.method(User, "findById", () =>
    makeUserQuery({ notificationPreferences: { friendRequests: { inApp: false } } }),
  );

  const res = makeResponse();
  await userController.acceptFriendRequest(
    {
      params: { id: String(pendingRequest._id) },
      user: { id: String(recipientId), _id: recipientId },
    },
    res,
  );

  assert.deepEqual(acceptanceFilter, {
    _id: String(pendingRequest._id),
    recipient: recipientId,
    status: "pending",
  });
  assert.equal(res.statusCode, 200);
});
