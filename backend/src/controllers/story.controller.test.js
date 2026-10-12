import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import mongoose from "mongoose";

process.env.STREAM_API_KEY ||= "test-stream-key";
process.env.STREAM_API_SECRET ||= "test-stream-secret";

const [
  { default: Story },
  { default: User },
  { default: Notification },
  storyController,
  notificationService,
] = await Promise.all([
  import("../models/Story.js"),
  import("../models/User.js"),
  import("../models/Notification.js"),
  import("./story.controller.js"),
  import("../services/notification.service.js"),
]);

const OWNER_ID = new mongoose.Types.ObjectId("64a000000000000000000001");
const FRIEND_ID = new mongoose.Types.ObjectId("64a000000000000000000002");
const OUTSIDER_ID = new mongoose.Types.ObjectId("64a000000000000000000003");
const STORY_ID = new mongoose.Types.ObjectId("64a000000000000000000004");

const makeStory = (overrides = {}) => {
  const data = {
    _id: STORY_ID,
    user: OWNER_ID,
    privacy: "friends",
    expiresAt: new Date(Date.now() + 60_000),
    viewers: [],
    reactions: [],
    reports: [],
    mediaUrl: "https://cdn.stream-io-cdn.com/story-image.png",
    mediaType: "image",
    ...overrides,
  };

  return {
    ...data,
    toObject() {
      const result = { ...this };
      delete result.toObject;
      return result;
    },
  };
};

const queryFor = (story) => ({
  select: async () => story,
  populate: async () => story,
  then: (resolve, reject) => Promise.resolve(story).then(resolve, reject),
});

const response = () => ({
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

const request = (userId, extras = {}) => ({
  user: {
    _id: userId,
    friends: userId.toString() === FRIEND_ID.toString() ? [OWNER_ID] : [],
    hiddenStoryUsers: [],
  },
  params: { id: STORY_ID.toString() },
  body: {},
  ...extras,
});

afterEach(() => mock.restoreAll());

test("Story schema caps video duration at 60 seconds", () => {
  assert.equal(Story.schema.path("durationSeconds").options.max, 60);
});

test("createStory persists validated media and a 24-hour expiration", async () => {
  let savedStory;
  mock.method(Story, "create", async (data) => {
    savedStory = data;
    return data;
  });

  const res = response();
  await storyController.createStory(
    request(OWNER_ID, {
      body: {
        mediaUrl: "https://cdn.stream-io-cdn.com/story-image.png",
        mediaType: "image",
        mediaSize: 1024,
        text: "  Hello  ",
      },
    }),
    res,
  );

  assert.equal(res.statusCode, 201);
  assert.equal(savedStory.user, OWNER_ID);
  assert.equal(savedStory.text, "Hello");
  assert.equal(
    savedStory.expiresAt.getTime() - savedStory.createdAt.getTime(),
    24 * 60 * 60 * 1000,
  );
});

test("createStory accepts a video at 60 seconds", async () => {
  let savedStory;
  mock.method(Story, "create", async (data) => {
    savedStory = data;
    return data;
  });

  const res = response();
  await storyController.createStory(
    request(OWNER_ID, {
      body: {
        mediaUrl: "https://cdn.stream-io-cdn.com/story-video.mp4",
        mediaType: "video",
        mediaSize: 1024,
        durationSeconds: 60,
      },
    }),
    res,
  );

  assert.equal(res.statusCode, 201);
  assert.equal(savedStory.durationSeconds, 60);
});

test("createStory rejects video duration above 60 seconds", async () => {
  let createCalled = false;
  mock.method(Story, "create", async () => {
    createCalled = true;
  });

  const res = response();
  await storyController.createStory(
    request(OWNER_ID, {
      body: {
        mediaUrl: "https://cdn.stream-io-cdn.com/story-video.mp4",
        mediaType: "video",
        mediaSize: 1024,
        durationSeconds: 60.01,
      },
    }),
    res,
  );

  assert.equal(res.statusCode, 400);
  assert.equal(createCalled, false);
});

test("getStories returns counts and viewed state without viewer IDs", async () => {
  let pipeline;
  let stories = [
    makeStory({
      viewCount: 2,
      viewedByMe: true,
      user: { _id: OWNER_ID, fullName: "Owner" },
    }).toObject(),
  ];
  mock.method(Story, "aggregate", async (stages) => {
    pipeline = stages;
    return stories;
  });

  const ownerRes = response();
  await storyController.getStories(request(OWNER_ID), ownerRes);

  assert.equal(ownerRes.statusCode, 200);
  assert.equal(ownerRes.body[0].viewCount, 2);
  assert.equal(ownerRes.body[0].viewedByMe, true);
  assert.equal(Object.hasOwn(ownerRes.body[0], "viewers"), false);

  stories = [
    makeStory({
      viewCount: 2,
      viewedByMe: true,
      user: { _id: OWNER_ID, fullName: "Owner" },
    }).toObject(),
  ];
  const friendRes = response();
  await storyController.getStories(request(FRIEND_ID), friendRes);

  assert.equal(friendRes.statusCode, 200);
  assert.equal(Object.hasOwn(friendRes.body[0], "viewCount"), false);
  assert.equal(friendRes.body[0].viewedByMe, true);
  assert.equal(Object.hasOwn(friendRes.body[0], "viewers"), false);
  assert.deepEqual(pipeline[0].$match.expiresAt.$gt instanceof Date, true);
  assert.ok(
    pipeline.some((stage) => stage.$addFields?.viewCount?.$size?.$setUnion),
  );
  assert.equal(
    pipeline.some((stage) => stage.$project?.viewers === 0),
    true,
  );
});

test("viewStory persists a deduplicated view without exposing owner-only counts", async () => {
  const viewers = new Set();
  const story = () => makeStory({ viewers: [...viewers] });
  let updateCount = 0;

  mock.method(Story, "findById", () => queryFor(story()));
  mock.method(Story, "updateOne", async (filter, update) => {
    updateCount += 1;
    assert.ok(filter.expiresAt.$gt instanceof Date);
    assert.equal(update.$addToSet.viewers, FRIEND_ID);
    viewers.add(FRIEND_ID.toString());
    return { matchedCount: 1 };
  });
  mock.method(Story, "aggregate", async () => [
    makeStory({ viewCount: viewers.size, viewedByMe: true }).toObject(),
  ]);

  const first = response();
  await storyController.viewStory(request(FRIEND_ID), first);
  const second = response();
  await storyController.viewStory(request(FRIEND_ID), second);

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(first.body.viewedByMe, true);
  assert.equal(second.body.viewedByMe, true);
  assert.equal(Object.hasOwn(first.body, "viewCount"), false);
  assert.equal(Object.hasOwn(second.body, "viewCount"), false);
  assert.equal(updateCount, 2);
  assert.equal(viewers.size, 1);
  assert.equal(Object.hasOwn(second.body, "viewers"), false);
});

test("viewStory denies non-friends and returns 404/410 for missing or expired stories", async (t) => {
  await t.test("non-friend cannot view", async () => {
    mock.method(Story, "findById", () => queryFor(makeStory()));
    const res = response();
    await storyController.viewStory(request(OUTSIDER_ID), res);
    assert.equal(res.statusCode, 403);
  });

  await t.test("deleted story returns 404", async () => {
    mock.method(Story, "findById", () => queryFor(null));
    const res = response();
    await storyController.viewStory(request(FRIEND_ID), res);
    assert.equal(res.statusCode, 404);
  });

  await t.test("expired story cannot be viewed or reacted to", async () => {
    mock.method(Story, "findById", () =>
      queryFor(makeStory({ expiresAt: new Date(Date.now() - 1000) })),
    );
    const viewRes = response();
    await storyController.viewStory(request(FRIEND_ID), viewRes);
    assert.equal(viewRes.statusCode, 410);

    const reactionRes = response();
    await storyController.addReaction(
      request(FRIEND_ID, { body: { type: "❤️" } }),
      reactionRes,
    );
    assert.equal(reactionRes.statusCode, 410);
  });
});

test("getStoryViewers exposes viewer records only to the owner", async (t) => {
  await t.test("owner can explicitly request viewer details", async () => {
    const viewers = [
      { _id: FRIEND_ID, fullName: "Friend" },
      { _id: FRIEND_ID, fullName: "Friend duplicate" },
    ];
    mock.method(Story, "findById", () => queryFor(makeStory({ viewers })));
    const res = response();
    await storyController.getStoryViewers(request(OWNER_ID), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, [viewers[1]]);
  });

  await t.test("non-owner is forbidden", async () => {
    mock.method(Story, "findById", () => queryFor(makeStory()));
    const res = response();
    await storyController.getStoryViewers(request(FRIEND_ID), res);
    assert.equal(res.statusCode, 403);
  });
});

test("reactions create, change, remove, and return privacy-aware response contracts", async () => {
  const reactions = [];
  let createdNotifications = 0;
  let notificationUpdates = 0;
  const storedStory = () =>
    makeStory({ reactions: reactions.map((item) => ({ ...item })) });

  mock.method(Story, "findById", () => queryFor(storedStory()));
  mock.method(Story, "findOneAndUpdate", async (_filter, update) => {
    if (Array.isArray(update)) {
      const expression = update[0].$set.reactions.$concatArrays;
      const actorId = expression[0].$filter.cond.$ne[1];
      const replacement = expression[1][0];
      const remaining = reactions.filter(
        (item) => item.user.toString() !== actorId.toString(),
      );
      reactions.splice(0, reactions.length, ...remaining, replacement);
    } else if (update.$pull?.reactions?.user) {
      const actorId = update.$pull.reactions.user;
      const remaining = reactions.filter(
        (item) => item.user.toString() !== actorId.toString(),
      );
      reactions.splice(0, reactions.length, ...remaining);
    }
    return storedStory();
  });
  mock.method(User, "findById", () => ({
    select: async () => ({ notificationPreferences: {} }),
  }));
  mock.method(Notification, "findOneAndUpdate", async () => {
    notificationUpdates += 1;
    if (notificationUpdates === 1) return null;
    return { _id: "existing-notification", reactionType: "❤️" };
  });
  mock.method(Notification, "create", async () => {
    createdNotifications += 1;
    return { _id: "new-notification" };
  });
  mock.method(Notification, "findById", () => ({
    populate: () => ({ lean: async () => null }),
  }));

  const addFirst = response();
  await storyController.addReaction(
    request(FRIEND_ID, { body: { type: "❤️" } }),
    addFirst,
  );
  assert.equal(addFirst.statusCode, 200);
  assert.deepEqual(addFirst.body.reactions, []);
  assert.equal(addFirst.body.myReaction, "❤️");
  assert.equal(reactions.length, 1);

  const change = response();
  await storyController.addReaction(
    request(FRIEND_ID, { body: { type: "🔥" } }),
    change,
  );
  assert.equal(reactions.length, 1);
  assert.equal(change.body.myReaction, "🔥");
  assert.deepEqual(change.body.reactions, []);

  const ownerReaction = response();
  await storyController.addReaction(
    request(OWNER_ID, { body: { type: "👍" } }),
    ownerReaction,
  );
  assert.deepEqual(ownerReaction.body.reactions, [
    { type: "🔥", count: 1 },
    { type: "👍", count: 1 },
  ]);
  assert.equal(ownerReaction.body.myReaction, "👍");

  const remove = response();
  await storyController.removeReaction(request(FRIEND_ID), remove);
  assert.equal(remove.body.myReaction, null);
  assert.equal(reactions.length, 1);
  assert.equal(createdNotifications, 1);
  assert.equal(notificationUpdates, 2);
});

test("notification preferences suppress delivery and repeated replies upsert by message ID", async (t) => {
  await t.test(
    "disabled Story reactions do not persist a notification",
    async () => {
      let creates = 0;
      mock.method(User, "findById", () => ({
        select: async () => ({
          notificationPreferences: { storyReactions: { inApp: false } },
        }),
      }));
      mock.method(Notification, "create", async () => {
        creates += 1;
      });

      const result = await notificationService.createNotification({
        recipient: OWNER_ID,
        actor: FRIEND_ID,
        type: "story_reaction",
        story: STORY_ID,
        reactionType: "❤️",
      });

      assert.equal(result, null);
      assert.equal(creates, 0);
    },
  );

  await t.test(
    "Story replies upsert on their unique Stream message ID",
    async () => {
      const notification = { _id: "reply-notification" };
      const upserts = [];
      let creates = 0;
      mock.method(User, "findById", () => ({
        select: async () => ({ notificationPreferences: {} }),
      }));
      mock.method(Notification, "findOneAndUpdate", async (...args) => {
        upserts.push(args);
        return notification;
      });
      mock.method(Notification, "findById", () => ({
        populate: () => ({ lean: async () => null }),
      }));
      mock.method(Notification, "create", async () => {
        creates += 1;
      });

      await notificationService.createNotification({
        recipient: OWNER_ID,
        actor: FRIEND_ID,
        type: "story_reply",
        story: STORY_ID,
        messageId: "stream-message-123",
      });
      await notificationService.createNotification({
        recipient: OWNER_ID,
        actor: FRIEND_ID,
        type: "story_reply",
        story: STORY_ID,
        messageId: "stream-message-123",
      });

      assert.equal(upserts.length, 2);
      assert.equal(upserts[0][0].messageId, "stream-message-123");
      assert.equal(upserts[0][2].upsert, true);
      assert.equal(creates, 0);
    },
  );
});
