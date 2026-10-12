import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import mongoose from "mongoose";

const [{ default: CallHistory }, { default: User }, { getCallHistory }] =
  await Promise.all([
    import("../models/CallHistory.js"),
    import("../models/User.js"),
    import("./callHistory.controller.js"),
  ]);

const currentUserId = new mongoose.Types.ObjectId(
  "64a000000000000000000001",
);
const matchingUserId = new mongoose.Types.ObjectId(
  "64a000000000000000000002",
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
