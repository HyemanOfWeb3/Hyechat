import assert from "node:assert/strict";
import test from "node:test";
import { getSafeSocialLinks } from "./safeSocialLinks.js";

test("renders only HTTPS links on the configured social domains", () => {
  const links = getSafeSocialLinks({
    x: "https://x.com/language_friend",
    instagram: "https://instagram.com/learner",
    facebook: "https://facebook.com/learner",
    tiktok: "https://tiktok.com/@learner",
    unknown: "https://example.com/attacker",
  });

  assert.deepEqual(links, [
    ["x", "https://x.com/language_friend"],
    ["instagram", "https://instagram.com/learner"],
    ["facebook", "https://facebook.com/learner"],
    ["tiktok", "https://tiktok.com/@learner"],
  ]);
});

test("rejects non-HTTPS social URLs even when the hostname is otherwise valid", () => {
  assert.deepEqual(
    getSafeSocialLinks({
      x: "http://x.com/language_friend",
      instagram: "http://instagram.com/learner",
      facebook: "http://facebook.com/learner",
      tiktok: "http://tiktok.com/@learner",
    }),
    [],
  );
});

test("rejects lookalike domains, credentials, and malformed social-link data", () => {
  assert.deepEqual(
    getSafeSocialLinks({
      x: "https://x.com.attacker.example/user",
      instagram: "https://user:pass@instagram.com/learner",
      facebook: "javascript:alert(1)",
    }),
    [],
  );
  assert.deepEqual(getSafeSocialLinks(["https://x.com/user"]), []);
});
