import assert from "node:assert/strict";
import { once } from "node:events";
import { after, test } from "node:test";

process.env.STREAM_API_KEY ||= "test-stream-key";
process.env.STREAM_API_SECRET ||= "test-stream-secret";

const { default: app } = await import("../app.js");
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const baseUrl = `http://127.0.0.1:${server.address().port}`;
after(() => server.close());

test("login failures are throttled before credentials can be brute-forced", async () => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 400);
  }

  const limitedResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(limitedResponse.status, 429);
});
