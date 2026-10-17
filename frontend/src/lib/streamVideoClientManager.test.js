import assert from "node:assert/strict";
import test from "node:test";
import { createStreamVideoClientManager } from "./streamVideoClientManager.js";

const user = (id) => ({ _id: id, fullName: `User ${id}`, profilePic: "" });

test("same-user concurrent requests share one authenticated video client", async () => {
  const created = [];
  const manager = createStreamVideoClientManager(
    (options) => {
      const client = { options, disconnectUser: async () => {} };
      created.push(client);
      return client;
    },
    () => "test-api-key",
  );

  const [first, second] = await Promise.all([
    manager.get({ user: user("u1"), token: "token-1" }),
    manager.get({ user: user("u1"), token: "token-1" }),
  ]);

  assert.equal(first, second);
  assert.equal(created.length, 1);
  assert.equal(first.options.user.id, "u1");
  assert.equal(first.options.token, "token-1");
});

test("switching authenticated users disconnects the old client before replacement", async () => {
  const created = [];
  let oldClientDisconnected = false;
  const manager = createStreamVideoClientManager(
    (options) => {
      const client = {
        options,
        disconnectUser: async () => {
          if (options.user.id === "u1") oldClientDisconnected = true;
        },
      };
      created.push(client);
      return client;
    },
    () => "test-api-key",
  );

  const first = await manager.get({ user: user("u1"), token: "token-1" });
  const second = await manager.get({ user: user("u2"), token: "token-2" });

  assert.equal(oldClientDisconnected, true);
  assert.notEqual(first, second);
  assert.equal(manager.getCurrent(), second);
  assert.equal(second.options.user.id, "u2");
});

test("disconnect clears the cached client and rejects missing auth/configuration", async () => {
  let disconnects = 0;
  const manager = createStreamVideoClientManager(
    () => ({
      disconnectUser: async () => {
        disconnects += 1;
      },
    }),
    () => "test-api-key",
  );

  await assert.rejects(
    manager.get({ user: user("u1"), token: "" }),
    /token is required/,
  );
  await assert.rejects(
    manager.get({ user: {}, token: "token" }),
    /signed-in user is required/,
  );
  await manager.get({ user: user("u1"), token: "token" });
  await manager.disconnect();
  assert.equal(disconnects, 1);
  assert.equal(manager.getCurrent(), undefined);

  const missingKey = createStreamVideoClientManager(
    () => ({}),
    () => "",
  );
  await assert.rejects(
    missingKey.get({ user: user("u1"), token: "token" }),
    /not configured/,
  );
});
