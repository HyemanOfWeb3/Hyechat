import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeSocialLink,
  validateAndNormalizeSocialLinks,
} from "./socialLinks.js";

test("normalizes supported social handles into canonical HTTPS profile URLs", () => {
  assert.equal(
    normalizeSocialLink("x", "@language_friend"),
    "https://x.com/language_friend",
  );
  assert.equal(
    normalizeSocialLink("instagram", "learner.one"),
    "https://instagram.com/learner.one",
  );
  assert.equal(
    normalizeSocialLink("facebook", "https://www.facebook.com/learner"),
    "https://facebook.com/learner",
  );
  assert.equal(
    normalizeSocialLink("tiktok", "https://www.tiktok.com/@learner"),
    "https://tiktok.com/@learner",
  );
  assert.equal(normalizeSocialLink("instagram", ""), null);
});

test("rejects deceptive domains and unsupported URL schemes", () => {
  assert.throws(() =>
    normalizeSocialLink(
      "instagram",
      "https://instagram.com.attacker.example/user",
    ),
  );
  assert.throws(() =>
    normalizeSocialLink("instagram", "https://unrecognized.instagram.com/user"),
  );
  assert.throws(() => normalizeSocialLink("x", "javascript:alert(1)"));
  assert.throws(() =>
    normalizeSocialLink("tiktok", "https://example.org/@user"),
  );
});

test("partial social updates preserve only validated canonical existing links", () => {
  const result = validateAndNormalizeSocialLinks(
    { instagram: "@language_learner" },
    {
      x: "https://x.com/safe_user",
      facebook: "javascript:alert(1)",
      tiktok: null,
    },
  );

  assert.deepEqual(result, {
    x: "https://x.com/safe_user",
    instagram: "https://instagram.com/language_learner",
    facebook: null,
    tiktok: null,
  });
});
