import assert from "node:assert/strict";
import test from "node:test";
import {
  MARKETPLACE_MEDIA_LIMITS,
  createMarketplacePendingPath,
  getMarketplaceMediaState,
  getMarketplaceListingImages,
  splitMarketplaceImageSelection,
  validateMarketplaceImageDimensions,
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

test("enforces readable image dimension limits", () => {
  assert.equal(
    validateMarketplaceImageDimensions({ width: 1920, height: 1080 }),
    "",
  );
  assert.match(
    validateMarketplaceImageDimensions({ width: 9000, height: 1 }),
    /8192 pixels/,
  );
  assert.match(
    validateMarketplaceImageDimensions({ width: 8192, height: 8192 }),
    /40 megapixels/,
  );
  assert.match(
    validateMarketplaceImageDimensions({ width: 0, height: 100 }),
    /readable/,
  );
});

test("prefers imageUrls and falls back to the legacy imageUrl field", () => {
  assert.deepEqual(
    getMarketplaceListingImages({
      imageUrls: ["https://cdn.example/new.webp"],
      imageUrl: "https://cdn.example/legacy.jpg",
    }),
    ["https://cdn.example/new.webp"],
  );
  assert.deepEqual(
    getMarketplaceListingImages({ imageUrl: "https://cdn.example/legacy.jpg" }),
    ["https://cdn.example/legacy.jpg"],
  );
  assert.deepEqual(getMarketplaceListingImages({}), []);
});

test("splits selections at the five-image limit and includes pending reservations", () => {
  const files = Array.from({ length: 7 }, (_, index) => ({ name: `${index}.jpg` }));
  const firstSelection = splitMarketplaceImageSelection(files, 0);
  assert.equal(firstSelection.accepted.length, 5);
  assert.deepEqual(firstSelection.rejected, files.slice(5));

  const laterSelection = splitMarketplaceImageSelection(files.slice(0, 2), 2, 1);
  assert.deepEqual(laterSelection.accepted, [files[0], files[1]]);
  const fullSelection = splitMarketplaceImageSelection(files, 4, 1);
  assert.deepEqual(fullSelection.accepted, []);
  assert.equal(fullSelection.rejected.length, 7);
});

test("media readiness blocks publishing until uploads and replacements finish", () => {
  assert.equal(getMarketplaceMediaState({}).isReady, true);
  assert.equal(
    getMarketplaceMediaState({
      images: [{ status: "uploading" }],
    }).hasPendingUpload,
    true,
  );
  assert.equal(
    getMarketplaceMediaState({
      video: { status: "validating" },
    }).isReady,
    false,
  );
  assert.equal(
    getMarketplaceMediaState({ activeValidations: 1 }).hasPendingUpload,
    true,
  );
  assert.equal(
    getMarketplaceMediaState({ errors: [{ message: "Rejected file" }] })
      .hasUploadError,
    true,
  );
  assert.equal(
    getMarketplaceMediaState({ images: [{ status: "error" }] }).isReady,
    false,
  );
});