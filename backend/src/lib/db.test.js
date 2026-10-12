import assert from "node:assert/strict";
import { test } from "node:test";
import { pingMongoConnection } from "./db.js";

test("MongoDB health ping uses a bounded server-side timeout", async () => {
  let options;
  await pingMongoConnection({
    connection: {
      db: {
        admin: () => ({
          ping: async (requestOptions) => {
            options = requestOptions;
          },
        }),
      },
    },
  });

  assert.deepEqual(options, { maxTimeMS: 5000 });
});

test("MongoDB health ping fails when there is no established database connection", async () => {
  await assert.rejects(
    pingMongoConnection({ connection: { db: null } }),
    { message: "MongoDB connection is unavailable" },
  );
});
