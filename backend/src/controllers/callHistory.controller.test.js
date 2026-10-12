import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import mongoose from "mongoose";

process.env.STREAM_API_KEY ||= "test-stream-key";
process.env.STREAM_API_SECRET ||= "test-stream-secret";

const [
  { default: CallHistory },
  { default: User },
  { getCallHistory, startCallHistory, endCallHistory },
  { getServerStreamVideoClient },
] = await Promise.all([
    import("../models/CallHistory.js"),
    import("../models/User.js"),
    import("./callHistory.controller.js"),
    import("../lib/streamVideo.js"),
  ]);

const currentUserId = new mongoose.Types.ObjectId(
  "64a000000000000000000001",
);
const matchingUserId = new mongoose.Types.ObjectId(
  "64a000000000000000000002",
);
const outsiderId = new mongoose.Types.ObjectId("64a000000000000000000003");
const callRoomId = "room-verified-members";

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

const makeHistoryQuery = () => ({
  populate() {
    return this;
  },
  sort() {
    return this;
  },
  skip() {
    return this;
  },
  limit: async () => [],
});

const mockVideoCall = ({ creatorId = currentUserId, memberIds, activeIds }) =>
  mock.method(getServerStreamVideoClient(), "call", (type, id) => {
    assert.equal(type, "default");
    assert.equal(id, callRoomId);
    return {
      get: async ({ members_limit }) => {
        assert.equal(members_limit, 100);
        return {
          call: { created_by: { id: creatorId.toString() } },
          members: memberIds.map((userId) => ({ user_id: userId.toString() })),
        };
      },
      queryParticipants: async (_filter, { limit }) => {
        assert.equal(limit, 100);
        return {
          participants: activeIds.map((userId) => ({ user: { id: userId.toString() } })),
        };
      },
    };
  });

const makeCallHistoryResponse = (res) => ({
  ...res,
  toObject() {
    return { ...this, toObject: undefined };
  },
  populate() {
    return Promise.resolve(this);
  },
});

afterEach(() => mock.restoreAll());

test("call-history search preserves the current participant and visibility filters", async () => {
  let userFilter;
  let historyFilter;
  mock.method(User, "find", (filter) => {
    userFilter = filter;
    return {
      select() {
        return this;
      },
      limit() {
        return this;
      },
      lean: async () => [{ _id: matchingUserId }],
    };
  });
  mock.method(CallHistory, "find", (filter) => {
    historyFilter = filter;
    return makeHistoryQuery();
  });

  const res = makeResponse();
  await getCallHistory(
    {
      user: { _id: currentUserId },
      query: { search: "Ada.*" },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(userFilter.fullName.$regex, "Ada\\.\\*");
  assert.equal(userFilter.fullName.$options, "i");
  assert.deepEqual(historyFilter, {
    hiddenFor: { $ne: currentUserId },
    $and: [
      { participants: currentUserId },
      { participants: { $in: [matchingUserId] } },
    ],
  });
});

test("call-history listing without a search stays scoped to the current user", async () => {
  let historyFilter;
  mock.method(CallHistory, "find", (filter) => {
    historyFilter = filter;
    return makeHistoryQuery();
  });

  const res = makeResponse();
  await getCallHistory({ user: { _id: currentUserId }, query: {} }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(historyFilter.participants, currentUserId);
  assert.deepEqual(historyFilter.hiddenFor, { $ne: currentUserId });
  assert.equal(historyFilter.$and, undefined);
});

test("call-history creation derives members and unanswered status from Stream, not request claims", async () => {
  mockVideoCall({
    memberIds: [currentUserId, matchingUserId],
    activeIds: [currentUserId],
  });
  mock.method(CallHistory, "findOne", async () => null);
  let update;
  mock.method(CallHistory, "findOneAndUpdate", (_filter, nextUpdate) => {
    update = nextUpdate.$set;
    return {
      populate() {
        return Promise.resolve(makeCallHistoryResponse({
          ...nextUpdate.$set,
          hiddenFor: [],
        }));
      },
    };
  });

  const res = makeResponse();
  await startCallHistory(
    {
      user: { _id: currentUserId },
      body: {
        roomId: callRoomId,
        callType: "video",
        participantIds: [outsiderId.toString()],
        answered: true,
      },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(
    update.participants.map(String).sort(),
    [String(currentUserId), String(matchingUserId)].sort(),
  );
  assert.equal(update.caller.toString(), currentUserId.toString());
  assert.equal(update.status, "outgoing");
  assert.equal(update.answeredAt, undefined);
});

test("call-history creation denies authenticated users absent from Stream membership", async () => {
  mockVideoCall({
    memberIds: [currentUserId, matchingUserId],
    activeIds: [currentUserId],
  });
  const findHistory = mock.method(CallHistory, "findOne", async () => null);
  const saveHistory = mock.method(CallHistory, "findOneAndUpdate", async () => {
    throw new Error("must not persist an unauthorized call");
  });

  const res = makeResponse();
  await startCallHistory(
    { user: { _id: outsiderId }, body: { roomId: callRoomId } },
    res,
  );

  assert.equal(res.statusCode, 403);
  assert.equal(findHistory.mock.callCount(), 0);
  assert.equal(saveHistory.mock.callCount(), 0);
});

test("call history marks answered only when Stream reports multiple active participants", async () => {
  mockVideoCall({
    memberIds: [currentUserId, matchingUserId],
    activeIds: [currentUserId, matchingUserId],
  });
  mock.method(CallHistory, "findOne", async () => null);
  let update;
  mock.method(CallHistory, "findOneAndUpdate", (_filter, nextUpdate) => {
    update = nextUpdate.$set;
    return {
      populate() {
        return Promise.resolve(makeCallHistoryResponse({
          ...nextUpdate.$set,
          hiddenFor: [],
        }));
      },
    };
  });

  const res = makeResponse();
  await startCallHistory(
    {
      user: { _id: currentUserId },
      body: { roomId: callRoomId, answered: false },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(update.status, "completed");
  assert.ok(update.answeredAt instanceof Date);
});

test("call-history end requires Stream membership and waits for active participants to leave", async () => {
  mockVideoCall({
    memberIds: [currentUserId, matchingUserId],
    activeIds: [matchingUserId],
  });
  const save = mock.fn(async () => {});
  mock.method(CallHistory, "findOne", async () => ({
    endedAt: null,
    answeredAt: null,
    save,
    toObject: () => ({}),
  }));

  const res = makeResponse();
  await endCallHistory(
    { params: { roomId: callRoomId }, user: { _id: currentUserId } },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { success: true, ended: false });
  assert.equal(save.mock.callCount(), 0);
});

test("call-history end completes only after all Stream participants have left", async () => {
  mockVideoCall({
    memberIds: [currentUserId, matchingUserId],
    activeIds: [],
  });
  const record = {
    endedAt: null,
    answeredAt: new Date(Date.now() - 5_000),
    duration: 0,
    status: "completed",
    save: async function () {},
    toObject() {
      return { endedAt: this.endedAt, status: this.status, duration: this.duration };
    },
  };
  const save = mock.method(record, "save", async function () {});
  mock.method(CallHistory, "findOne", async () => record);

  const res = makeResponse();
  await endCallHistory(
    { params: { roomId: callRoomId }, user: { _id: currentUserId } },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.ok(record.endedAt instanceof Date);
  assert.ok(record.duration >= 0);
  assert.equal(record.status, "completed");
  assert.equal(save.mock.callCount(), 1);
});

test("call-history end rejects a user outside the verified Stream roster", async () => {
  mockVideoCall({
    memberIds: [currentUserId, matchingUserId],
    activeIds: [],
  });
  const findHistory = mock.method(CallHistory, "findOne", async () => null);

  const res = makeResponse();
  await endCallHistory(
    { params: { roomId: callRoomId }, user: { _id: outsiderId } },
    res,
  );

  assert.equal(res.statusCode, 403);
  assert.equal(findHistory.mock.callCount(), 0);
});
