import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProfileShareDetails,
  shareProfileOrCopy,
} from "./profileSharing.js";

test("builds canonical profile sharing data using the current deployment origin", () => {
  const { canonicalUrl, shareData } = buildProfileShareDetails(
    {
      _id: "user 123",
      fullName: "Language Learner",
      bio: "Practising Spanish",
    },
    "https://hyechat.example.test",
  );

  assert.equal(canonicalUrl, "https://hyechat.example.test/profile/user%20123");
  assert.equal(shareData.url, canonicalUrl);
  assert.equal(shareData.title, "Language Learner on HyeChat");
  assert.match(shareData.text, /Practising Spanish/);
});

test("uses the copy fallback when native sharing is unavailable or fails", async () => {
  let copyCount = 0;
  const copy = async () => {
    copyCount += 1;
  };

  assert.equal(await shareProfileOrCopy({ copy, shareData: {} }), "copied");
  assert.equal(
    await shareProfileOrCopy({
      share: async () => {
        throw new Error("native sharing unavailable");
      },
      copy,
      shareData: {},
    }),
    "copied",
  );
  assert.equal(copyCount, 2);
});

test("does not copy when the user cancels native sharing", async () => {
  let copyCount = 0;
  const result = await shareProfileOrCopy({
    share: async () => {
      throw Object.assign(new Error("cancelled"), { name: "AbortError" });
    },
    copy: async () => {
      copyCount += 1;
    },
    shareData: {},
  });

  assert.equal(result, "cancelled");
  assert.equal(copyCount, 0);
});
