import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";

process.env.STREAM_API_KEY ||= "test-stream-key";
process.env.STREAM_API_SECRET ||= "test-stream-secret";

const { syncStreamUsers } = await import("./chat.controller.js");

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

test("Stream user sync rejects identities other than the authenticated user", async () => {
  const currentUserId = new mongoose.Types.ObjectId(
    "64a000000000000000000011",
  );
  const otherUserId = new mongoose.Types.ObjectId(
    "64a000000000000000000012",
  );
  const res = makeResponse();

  await syncStreamUsers(
    {
      user: {
        _id: currentUserId,
        fullName: "Authenticated user",
        profilePic: "https://cdn.example.test/authenticated.png",
      },
      body: {
        users: [
          {
            id: otherUserId.toString(),
            name: "Forged name",
            image: "https://attacker.example.test/avatar.png",
          },
        ],
      },
    },
    res,
  );

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { message: "Cannot sync another user's profile" });
});

test("Stream user sync rejects an empty user list", async () => {
  const res = makeResponse();
  await syncStreamUsers(
    { user: { _id: new mongoose.Types.ObjectId() }, body: { users: [] } },
    res,
  );
  assert.equal(res.statusCode, 400);
});
