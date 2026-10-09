import test from "node:test";
import assert from "node:assert/strict";
import {
  getAvatarFallbackClassName,
  getAvatarImageSource,
  getAvatarInitials,
} from "./avatar.js";

test("builds stable initials for names, single-word names, and empty names", () => {
  assert.equal(getAvatarInitials("Ada Lovelace"), "AL");
  assert.equal(getAvatarInitials("Soyeon"), "SO");
  assert.equal(getAvatarInitials("  "), "U");
});

test("keeps fallback styling deterministic for a stable user identity", () => {
  assert.equal(
    getAvatarFallbackClassName("Ada Lovelace", "user-1"),
    getAvatarFallbackClassName("Ada Lovelace", "user-1"),
  );
  assert.notEqual(
    getAvatarFallbackClassName("Ada Lovelace", "user-1"),
    getAvatarFallbackClassName("Ada Lovelace", "user-2"),
  );
});

test("suppresses known placeholder providers while preserving uploaded image URLs", () => {
  assert.equal(
    getAvatarImageSource("https://avatarapi.runflare.run/public/23.png"),
    "",
  );
  assert.equal(
    getAvatarImageSource("https://avatar.iran.liara.run/public/23"),
    "",
  );
  assert.equal(
    getAvatarImageSource("https://cdn.example.com/uploads/avatar.webp"),
    "https://cdn.example.com/uploads/avatar.webp",
  );
  assert.equal(
    getAvatarImageSource("blob:https://hyechat.app/preview"),
    "blob:https://hyechat.app/preview",
  );
  assert.equal(getAvatarImageSource("javascript:alert(1)"), "");
  assert.equal(getAvatarImageSource(""), "");
});
