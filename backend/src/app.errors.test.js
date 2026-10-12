import assert from "node:assert/strict";
import { once } from "node:events";
import { after, test } from "node:test";

process.env.STREAM_API_KEY ||= "test-stream-key";
process.env.STREAM_API_SECRET ||= "test-stream-secret";
process.env.CLIENT_URL ||= "http://localhost:5173";

const { default: app } = await import("./app.js");
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const baseUrl = `http://127.0.0.1:${server.address().port}`;
after(() => server.close());

test("unknown API paths return JSON 404 instead of HTML", async () => {
  const response = await fetch(`${baseUrl}/api/not-a-real-route`);

  assert.equal(response.status, 404);
  assert.match(response.headers.get("content-type"), /application\/json/);
  assert.deepEqual(await response.json(), { message: "API route not found" });
});

test("malformed JSON returns a sanitized client error without parser details", async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(body, { message: "Invalid request" });
  assert.doesNotMatch(JSON.stringify(body), /SyntaxError|stack|Unexpected token/i);
});

test("unapproved browser origins are rejected before mutation routes run", async () => {
  const response = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: { Origin: "https://untrusted.example" },
  });
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.deepEqual(body, { message: "Forbidden" });
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});
