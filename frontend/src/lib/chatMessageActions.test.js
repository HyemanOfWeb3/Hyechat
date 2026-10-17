import assert from "node:assert/strict";
import test from "node:test";
import {
  buildContextualMessageActionSet,
  getMessageMenuCapabilities,
} from "./chatMessageActions.js";

const defaultActionSet = [
  { type: undefined, placement: "quick-dropdown-toggle" },
  { type: "reply", placement: "quick" },
  { type: "react", placement: "quick" },
  { type: "reply", placement: "dropdown" },
  { type: "react", placement: "dropdown" },
  { type: "copyMessageText", placement: "dropdown" },
  { type: "edit", placement: "dropdown" },
  { type: "delete", placement: "dropdown" },
  { type: "pin", placement: "dropdown" },
];

const customActions = [
  { type: "forward", placement: "dropdown" },
  { type: "viewProfile", placement: "dropdown" },
  { type: "voiceCall", placement: "dropdown" },
  { type: "videoCall", placement: "dropdown" },
];

test("contextual menu keeps configured Stream actions in the dropdown", () => {
  const actionSet = buildContextualMessageActionSet({
    defaultActionSet,
    allowedActions: ["reply", "react", "delete"],
    customActions,
    canContactAuthor: true,
    canForward: true,
  });

  assert.deepEqual(
    actionSet.map(({ type, placement }) => [type, placement]),
    [
      [undefined, "quick-dropdown-toggle"],
      ["reply", "dropdown"],
      ["react", "dropdown"],
      ["copyMessageText", "dropdown"],
      ["delete", "dropdown"],
      ["forward", "dropdown"],
      ["viewProfile", "dropdown"],
      ["voiceCall", "dropdown"],
      ["videoCall", "dropdown"],
    ],
  );
});

test("custom message actions are hidden when they do not apply", () => {
  const actionSet = buildContextualMessageActionSet({
    defaultActionSet,
    allowedActions: ["reply"],
    customActions,
  });

  assert.deepEqual(
    actionSet.map(({ type }) => type),
    [undefined, "reply", "copyMessageText"],
  );
});

test("message menu capabilities respect authorship and message content", () => {
  const peerMessage = { user: { id: "peer" }, text: "Hello" };
  assert.deepEqual(getMessageMenuCapabilities(peerMessage, "me"), {
    canContactAuthor: true,
    canForward: true,
  });
  assert.deepEqual(getMessageMenuCapabilities(peerMessage, "peer"), {
    canContactAuthor: false,
    canForward: true,
  });
  assert.deepEqual(
    getMessageMenuCapabilities(
      { user: { id: "peer" }, attachments: [{ type: "image" }] },
      "me",
    ),
    { canContactAuthor: true, canForward: true },
  );
  assert.deepEqual(
    getMessageMenuCapabilities({ user: { id: "peer" } }, "me"),
    { canContactAuthor: true, canForward: false },
  );
});

test("deleted, system, and call messages do not get invalid custom actions", () => {
  for (const message of [
    { user: { id: "peer" }, type: "system", text: "system" },
    { user: { id: "peer" }, type: "deleted", text: "deleted" },
    { user: { id: "peer" }, text: "removed", deleted_at: new Date() },
  ]) {
    assert.deepEqual(getMessageMenuCapabilities(message, "me"), {
      canContactAuthor: false,
      canForward: false,
    });
  }

  assert.deepEqual(
    getMessageMenuCapabilities(
      { user: { id: "peer" }, text: "call details" },
      "me",
      { isCallMessage: true },
    ),
    { canContactAuthor: true, canForward: false },
  );
});
