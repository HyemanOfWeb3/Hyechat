import assert from "node:assert/strict";
import test from "node:test";
import {
  isValidMarketplaceContactUrl,
  resolveMarketplaceListingMedia,
  validateMarketplaceListingUpdate,
} from "./marketplaceListingUpdate.js";

const originalListing = {
  imageUrls: ["https://legacy.example/first.jpg"],
  imageUrl: "https://legacy.example/first.jpg",
  videoUrl: "https://legacy.example/clip.mp4",
};

test("listing updates accept only whitelisted editable fields", () => {
  for (const body of [
    null,
    [],
    {},
    { seller: "other-user" },
    { status: "active" },
    { type: "physical_product" },
    { _id: "another-listing" },
  ]) {
    assert.ok(validateMarketplaceListingUpdate(body).error);
  }

  assert.deepEqual(validateMarketplaceListingUpdate({ title: "New title" }), {
    updates: { title: "New title" },
  });
});

test("listing update validation rejects invalid types and bounds", () => {
  const invalidUpdates = [
    { title: "no" },
    { title: 12 },
    { description: 12 },
    { description: "x".repeat(2001) },
    { category: " " },
    { category: "x".repeat(81) },
    { price: "12.50" },
    { price: -1 },
    { currency: "US" },
    { location: 42 },
    { contactMethod: "phone" },
    { contactUrl: 42 },
    { imageUrls: Array(6).fill("https://cdn.example/image.jpg") },
    { imageUrls: [null] },
    { videoUrl: 42 },
  ];

  for (const body of invalidUpdates) {
    assert.ok(validateMarketplaceListingUpdate(body).error, JSON.stringify(body));
  }
  assert.equal(isValidMarketplaceContactUrl("javascript:alert(1)"), false);
  assert.equal(isValidMarketplaceContactUrl("https://events.example/tickets"), true);
});

test("current listing media can be retained without remote cleanup or re-upload", async () => {
  let verificationCount = 0;
  const resolved = await resolveMarketplaceListingMedia({
    updates: {
      imageUrls: originalListing.imageUrls,
      videoUrl: originalListing.videoUrl,
    },
    listing: originalListing,
    userId: "owner-id",
    verifyMediaUrl: async () => {
      verificationCount += 1;
      throw new Error("Existing media should not be re-uploaded");
    },
  });

  assert.equal(verificationCount, 0);
  assert.deepEqual(resolved.imageUrls, originalListing.imageUrls);
  assert.equal(resolved.imageUrl, "");
  assert.equal(resolved.videoUrl, originalListing.videoUrl);
});

test("new media is verified as owner media while replacements keep their order", async () => {
  const verified = [];
  const resolved = await resolveMarketplaceListingMedia({
    updates: {
      imageUrls: [
        "https://new.public.blob.vercel-storage.com/photo.webp",
        originalListing.imageUrls[0],
      ],
      videoUrl: "https://new.public.blob.vercel-storage.com/clip.webm",
    },
    listing: originalListing,
    userId: "owner-id",
    verifyMediaUrl: async (url, userId, kind) => {
      verified.push({ url, userId, kind });
      return { url };
    },
  });

  assert.deepEqual(verified, [
    {
      url: "https://new.public.blob.vercel-storage.com/photo.webp",
      userId: "owner-id",
      kind: "image",
    },
    {
      url: "https://new.public.blob.vercel-storage.com/clip.webm",
      userId: "owner-id",
      kind: "video",
    },
  ]);
  assert.deepEqual(resolved.imageUrls, [
    "https://new.public.blob.vercel-storage.com/photo.webp",
    originalListing.imageUrls[0],
  ]);
  assert.equal(resolved.videoUrl, "https://new.public.blob.vercel-storage.com/clip.webm");
});

test("removing all images from a legacy listing clears the compatibility URL", async () => {
  const resolved = await resolveMarketplaceListingMedia({
    updates: { imageUrls: [] },
    listing: { imageUrl: "https://legacy.example/only.jpg" },
    userId: "owner-id",
    verifyMediaUrl: async () => assert.fail("No media should need verification"),
  });

  assert.deepEqual(resolved.imageUrls, []);
  assert.equal(resolved.imageUrl, "");
});
