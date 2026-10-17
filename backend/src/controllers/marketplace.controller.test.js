import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import MarketplaceListing from "../models/MarketplaceListing.js";

const { createMarketplaceListing, serializeListing } =
  await import("./marketplace.controller.js");

const makeResponse = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

const makeRequest = (category, type = "physical_product") => ({
  body: { title: "Marketplace item", type, category },
  user: { _id: new mongoose.Types.ObjectId() },
});

test("listing creation requires a non-empty string category", async () => {
  for (const category of [undefined, null, 42, "", "   "]) {
    const res = makeResponse();
    await createMarketplaceListing(makeRequest(category), res);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { message: "Category is required" });
  }
});

test("listing creation rejects categories longer than 80 characters", async () => {
  const res = makeResponse();
  await createMarketplaceListing(makeRequest("x".repeat(81)), res);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {
    message: "Category must be 80 characters or fewer",
  });
});

test("listing creation still rejects unsupported persisted type values", async () => {
  const res = makeResponse();
  await createMarketplaceListing(
    makeRequest("Electronics", "unrecognized_type"),
    res,
  );
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { message: "Choose a valid listing type" });
});

test("listing creation trims predefined and custom categories into category", async (context) => {
  const createdListings = [];
  context.mock.method(MarketplaceListing, "create", async (listing) => {
    createdListings.push(listing);
    return {
      ...listing,
      _id: new mongoose.Types.ObjectId(),
      populate: async function populate() {
        return this;
      },
    };
  });

  for (const category of ["  Electronics  ", "  Ceramics  "]) {
    const res = makeResponse();
    await createMarketplaceListing(makeRequest(category), res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.listing.category, category.trim());
  }

  assert.deepEqual(
    createdListings.map((listing) => listing.category),
    ["Electronics", "Ceramics"],
  );
});

test("listing creation enforces the five-image maximum", async () => {
  const req = makeRequest("Electronics");
  req.body.imageUrls = Array.from(
    { length: 6 },
    (_, index) => `https://image${index}.example/photo.jpg`,
  );
  const res = makeResponse();

  await createMarketplaceListing(req, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { message: "Add up to 5 listing photos" });
});

test("listing serialization preserves current and legacy image references", () => {
  const modernListing = {
    _id: new mongoose.Types.ObjectId(),
    imageUrls: [
      "https://cdn.example/first.webp",
      "https://cdn.example/second.webp",
    ],
    imageUrl: "https://cdn.example/legacy.jpg",
    videoUrl: "https://cdn.example/clip.mp4",
  };
  const legacyListing = {
    _id: new mongoose.Types.ObjectId(),
    imageUrl: "https://cdn.example/legacy.jpg",
  };

  assert.deepEqual(
    serializeListing(modernListing).imageUrls,
    modernListing.imageUrls,
  );
  assert.equal(
    serializeListing(modernListing).videoUrl,
    modernListing.videoUrl,
  );
  assert.deepEqual(serializeListing(legacyListing).imageUrls, [
    legacyListing.imageUrl,
  ]);
});
