import assert from "node:assert/strict";
import test from "node:test";
import { getStoryViewCount, mergeStoryCacheUpdate } from "./storyCache.js";

test("getStoryViewCount prefers the count contract and supports legacy cache entries", () => {
  assert.equal(getStoryViewCount({ viewCount: 7, viewers: ["a"] }), 7);
  assert.equal(getStoryViewCount({ viewers: ["a", "b"] }), 2);
  assert.equal(getStoryViewCount({ viewCount: -1, viewers: ["a"] }), 1);
  assert.equal(getStoryViewCount({}), 0);
});

test("mergeStoryCacheUpdate applies new counts without retaining viewer IDs", () => {
  const story = {
    _id: "story-1",
    user: { _id: "owner-1" },
    viewCount: 2,
    viewers: ["viewer-1", "viewer-2"],
    viewedByMe: false,
    reactions: [{ user: "viewer-1", type: "❤️" }],
  };

  const updated = mergeStoryCacheUpdate(story, {
    _id: "story-1",
    viewCount: 3,
    viewedByMe: true,
    reactions: [{ user: "viewer-1", type: "🔥" }],
  });

  assert.equal(updated.viewCount, 3);
  assert.equal(updated.viewedByMe, true);
  assert.deepEqual(updated.reactions, [{ user: "viewer-1", type: "🔥" }]);
  assert.equal(Object.hasOwn(updated, "viewers"), false);
});

test("mergeStoryCacheUpdate preserves omitted fields without stale contradictions", () => {
  const story = {
    _id: "story-2",
    viewCount: 4,
    viewers: ["one", "two", "three", "four"],
    viewedByMe: true,
    reactions: [{ user: "viewer-1", type: "❤️" }],
  };

  const updated = mergeStoryCacheUpdate(story, { _id: "story-2" });

  assert.equal(updated.viewCount, 4);
  assert.equal(updated.viewedByMe, true);
  assert.deepEqual(updated.reactions, story.reactions);
  assert.equal(Object.hasOwn(updated, "viewers"), false);
});
