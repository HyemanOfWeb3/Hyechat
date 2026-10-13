import assert from "node:assert/strict";
import test from "node:test";
import {
  MARKETPLACE_MEDIA_LIMITS,
  createMarketplacePendingPath,
  validateMarketplaceMediaSelection,
} from "./marketplaceMedia.js";

test("accepts JPEG, PNG, WebP, MP4, and WebM within byte limits", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"]) {
    assert.equal(
      validateMarketplaceMediaSelection(
        { type, size: MARKETPLACE_MEDIA_LIMITS.image.maxBytes },
        "image",
      ),
      "",
    );
  }
  for (const type of ["video/mp4", "video/webm"]) {
    assert.equal(
      validateMarketplaceMediaSelection(
        { type, size: MARKETPLACE_MEDIA_LIMITS.video.maxBytes },
        "video",
      ),
      "",
    );
  }
});

test("rejects unsupported, empty, and oversized files before upload", () => {
  assert.match(
    validateMarketplaceMediaSelection(
      { type: "image/svg+xml", size: 100 },
      "image",
    ),
    /JPEG, PNG, or WebP/,
  );
  assert.match(
    validateMarketplaceMediaSelection({ type: "image/png", size: 0 }, "image"),
    /non-empty/,
  );
  assert.match(
    validateMarketplaceMediaSelection(
      { type: "image/png", size: MARKETPLACE_MEDIA_LIMITS.image.maxBytes + 1 },
      "image",
    ),
    /5 MB/,
  );
  assert.match(
    validateMarketplaceMediaSelection(
      { type: "video/webm", size: MARKETPLACE_MEDIA_LIMITS.video.maxBytes + 1 },
      "video",
    ),
    /25 MB/,
  );
});

test("builds owner-scoped paths using a MIME-derived extension", () => {
  assert.equal(
    createMarketplacePendingPath(
      "64a000000000000000000011",
      "123e4567-e89b-42d3-a456-426614174000",
      "video/webm",
    ),
    "marketplace/pending/64a000000000000000000011/123e4567-e89b-42d3-a456-426614174000.webm",
  );
  assert.throws(
    () => createMarketplacePendingPath("other-user", "bad-id", "image/png"),
    /Cannot prepare/,
  );
});