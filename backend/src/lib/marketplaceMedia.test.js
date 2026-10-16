import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_MARKETPLACE_IMAGE_SIZE,
  MAX_MARKETPLACE_VIDEO_DURATION_SECONDS,
  MAX_MARKETPLACE_VIDEO_SIZE,
  getMarketplaceMediaPathFromUrl,
  getMarketplacePendingMediaPath,
  inspectMarketplaceMediaBuffer,
  validateMarketplaceMediaMetadata,
  validateMarketplaceUploadCompletion,
  verifyMarketplaceMediaUrl,
} from "./marketplaceMedia.js";

const userId = "64a000000000000000000011";
const uploadId = "123e4567-e89b-42d3-a456-426614174000";
const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/qT8AAAAASUVORK5CYII=",
  "base64",
);

test("only permits media URLs in the authenticated user's pending Blob path", () => {
  const pathname = `marketplace/pending/${userId}/${uploadId}.png`;
  const url = `https://store.public.blob.vercel-storage.com/${pathname}`;
  assert.equal(
    getMarketplacePendingMediaPath(pathname, userId, "image").mimeType,
    "image/png",
  );
  assert.equal(getMarketplaceMediaPathFromUrl(url, userId, "image").url, url);
  assert.throws(
    () =>
      getMarketplaceMediaPathFromUrl(
        url,
        "64a000000000000000000012",
        "image",
      ),
    /current user/,
  );
  assert.throws(
    () =>
      getMarketplaceMediaPathFromUrl(
        `https://attacker.example/${pathname}`,
        userId,
        "image",
      ),
    /approved public storage/,
  );
  assert.throws(
    () =>
      getMarketplacePendingMediaPath(
        `marketplace/pending/${userId}/${uploadId}.svg`,
        userId,
      ),
    /filename/,
  );
  assert.throws(
    () =>
      getMarketplacePendingMediaPath(
        `marketplace/pending/${userId}/${uploadId}.mp4`,
        userId,
        "image",
      ),
    /Unsupported/,
  );
});

test("sniffs image bytes and rejects corrupt or unsupported buffers", async () => {
  const image = await inspectMarketplaceMediaBuffer(onePixelPng, {
    kind: "image",
    declaredMimeType: "image/png",
  });
  assert.equal(image.contentType, "image/png");
  assert.equal(image.width, 1);
  assert.equal(image.height, 1);

  await assert.rejects(
    inspectMarketplaceMediaBuffer(Buffer.from("not an image"), {
      kind: "image",
      declaredMimeType: "image/png",
    }),
    /corrupt or unsupported/,
  );
});

test("validates server-side image and video size, MIME, dimensions, and duration", () => {
  assert.throws(
    () =>
      validateMarketplaceMediaMetadata({
        kind: "image",
        size: MAX_MARKETPLACE_IMAGE_SIZE + 1,
        declaredMimeType: "image/png",
        detectedMimeType: "image/png",
        width: 1,
        height: 1,
      }),
    /5 MB/,
  );
  assert.throws(
    () =>
      validateMarketplaceMediaMetadata({
        kind: "image",
        size: 100,
        declaredMimeType: "image/png",
        detectedMimeType: "image/jpeg",
        width: 1,
        height: 1,
      }),
    /does not match/,
  );
  assert.throws(
    () =>
      validateMarketplaceMediaMetadata({
        kind: "image",
        size: 100,
        declaredMimeType: "image/png",
        detectedMimeType: "image/png",
        width: 9000,
        height: 1,
      }),
    /dimensions/,
  );
  assert.throws(
    () =>
      validateMarketplaceMediaMetadata({
        kind: "video",
        size: MAX_MARKETPLACE_VIDEO_SIZE + 1,
        declaredMimeType: "video/mp4",
        detectedMimeType: "video/mp4",
        duration: 10,
      }),
    /25 MB/,
  );
  assert.throws(
    () =>
      validateMarketplaceMediaMetadata({
        kind: "video",
        size: 100,
        declaredMimeType: "video/webm",
        detectedMimeType: "video/webm",
        duration: MAX_MARKETPLACE_VIDEO_DURATION_SECONDS + 0.1,
      }),
    /30 seconds/,
  );
});

test("verifies Blob metadata and bytes without trusting a submitted URL alone", async () => {
  const pathname = `marketplace/pending/${userId}/${uploadId}.png`;
  const url = `https://store.public.blob.vercel-storage.com/${pathname}`;
  const result = await verifyMarketplaceMediaUrl(url, userId, "image", {
    headBlob: async (path) => {
      assert.equal(path, pathname);
      return {
        pathname,
        url,
        contentType: "image/png",
        size: onePixelPng.length,
        etag: "mock-etag",
      };
    },
    fetchBlob: async () => new Response(onePixelPng, { status: 200 }),
  });
  assert.equal(result.url, url);
  assert.equal(result.width, 1);
  assert.equal(result.size, onePixelPng.length);

  await assert.rejects(
    verifyMarketplaceMediaUrl(url, userId, "image", {
      headBlob: async () => ({
        pathname,
        url,
        contentType: "image/png",
        size: Buffer.byteLength("not PNG"),
        etag: "mock-etag",
      }),
      fetchBlob: async () => new Response(Buffer.from("not PNG"), { status: 200 }),
    }),
    /corrupt or unsupported/,
  );

  await assert.rejects(
    verifyMarketplaceMediaUrl(url, userId, "image", {
      headBlob: async () => ({
        pathname,
        url: `https://another-store.public.blob.vercel-storage.com/${pathname}`,
        contentType: "image/png",
        size: onePixelPng.length,
        etag: "mock-etag",
      }),
      fetchBlob: async () => new Response(onePixelPng, { status: 200 }),
    }),
    /metadata is invalid/,
  );
});

test("validates signed upload completion metadata and verifies its blob", async () => {
  const pathname = `marketplace/pending/${userId}/${uploadId}.png`;
  const url = `https://store.public.blob.vercel-storage.com/${pathname}`;
  let verified;

  const result = await validateMarketplaceUploadCompletion(
    {
      blob: { url },
      tokenPayload: JSON.stringify({ userId, kind: "image", pathname }),
    },
    {
      verifyMedia: async (...args) => {
        verified = args;
      },
    },
  );

  assert.equal(result.pathname, pathname);
  assert.deepEqual(verified, [url, userId, "image"]);
  await assert.rejects(
    validateMarketplaceUploadCompletion({
      blob: { url },
      tokenPayload: "{invalid",
    }),
    /Invalid marketplace upload metadata/,
  );
  await assert.rejects(
    validateMarketplaceUploadCompletion({
      blob: { url },
      tokenPayload: JSON.stringify({ userId, kind: "image", pathname: "wrong" }),
    }),
    /path did not match its token/,
  );
});