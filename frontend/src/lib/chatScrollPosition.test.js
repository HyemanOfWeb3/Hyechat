import assert from "node:assert/strict";
import test from "node:test";
import {
  captureChatScrollPosition,
  getChatScrollStorageKey,
  readChatScrollPosition,
  restoreChatScrollPosition,
  writeChatScrollPosition,
} from "./chatScrollPosition.js";

const messageElement = (messageId, top, bottom = top + 30) => ({
  dataset: { messageId },
  getBoundingClientRect: () => ({ top, bottom }),
});

const listElement = ({
  scrollTop = 200,
  scrollHeight = 1000,
  clientHeight = 400,
  top = 100,
  messages = [],
} = {}) => ({
  scrollTop,
  scrollHeight,
  clientHeight,
  getBoundingClientRect: () => ({ top, bottom: top + clientHeight }),
  querySelectorAll: () => messages,
});

test("stores a channel-scoped, user-scoped scroll key", () => {
  assert.equal(
    getChatScrollStorageKey("user 1", "messaging:channel:1"),
    "hyechat:chat-scroll:user%201:messaging%3Achannel%3A1",
  );
});

test("captures an anchor and bottom state without storing message contents", () => {
  const list = listElement({
    messages: [
      messageElement("message-1", 120),
      messageElement("message-2", 160),
    ],
  });
  const snapshot = captureChatScrollPosition(list);

  assert.equal(snapshot.messageId, "message-1");
  assert.equal(snapshot.offsetTop, 20);
  assert.equal(snapshot.distanceFromBottom, 400);
  assert.equal(snapshot.wasAtBottom, false);
  assert.equal(Object.hasOwn(snapshot, "text"), false);
});

test("restores the same message anchor offset after layout changes", () => {
  const anchor = messageElement("message-1", 180);
  const list = listElement({ scrollTop: 300, messages: [anchor] });
  const restored = restoreChatScrollPosition(list, {
    messageId: "message-1",
    offsetTop: 40,
    wasAtBottom: false,
  });

  assert.equal(restored, true);
  assert.equal(list.scrollTop, 340);
});

test("does not restore bottom positions or missing message anchors", () => {
  const list = listElement({
    messages: [messageElement("other-message", 130)],
  });
  assert.equal(
    restoreChatScrollPosition(list, {
      messageId: "message-1",
      offsetTop: 20,
      wasAtBottom: true,
    }),
    false,
  );
  assert.equal(
    restoreChatScrollPosition(list, {
      messageId: "missing-message",
      offsetTop: 20,
      wasAtBottom: false,
    }),
    false,
  );
});

test("round-trips valid position state and ignores malformed or unavailable storage", () => {
  const records = new Map();
  const storage = {
    getItem: (key) => records.get(key) || null,
    setItem: (key, value) => records.set(key, value),
  };
  const snapshot = {
    messageId: "message-1",
    offsetTop: 25,
    distanceFromBottom: 300,
    wasAtBottom: false,
  };
  writeChatScrollPosition(storage, "key", snapshot);
  assert.deepEqual(readChatScrollPosition(storage, "key"), snapshot);
  records.set("bad", "not json");
  assert.equal(readChatScrollPosition(storage, "bad"), null);
  assert.equal(readChatScrollPosition(null, "key"), null);
  writeChatScrollPosition(null, "key", snapshot);
});
