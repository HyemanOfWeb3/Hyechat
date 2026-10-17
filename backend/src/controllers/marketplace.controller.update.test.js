import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import mongoose from "mongoose";
import MarketplaceListing from "../models/MarketplaceListing.js";
import MarketplaceListingReport from "../models/MarketplaceListingReport.js";
import User from "../models/User.js";
import { updateMarketplaceListing } from "./marketplace.controller.js";

const listingId = new mongoose.Types.ObjectId("64a000000000000000000201");
const ownerId = new mongoose.Types.ObjectId("64a000000000000000000202");
const otherUserId = new mongoose.Types.ObjectId("64a000000000000000000203");

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

const makeRequest = (body = { title: "Updated event title" }, userId = ownerId) => ({
  params: { id: listingId.toString() },
  body,
  user: userId ? { _id: userId } : undefined,
});

const makeListingDocument = (overrides = {}, { save } = {}) => {
  const listing = {
    _id: listingId,
    seller: ownerId,
    type: "event",
    title: "Original event title",
    description: "Original description",
    category: "Music",
    price: 10,
    currency: "USD",
    location: "Central Hall",
    contactMethod: "message",
    contactUrl: "",
    imageUrls: ["https://media.example/banner.jpg"],
    imageUrl: "",
    videoUrl: "https://media.example/event.mp4",
    status: "hidden",
    set(updates) {
      Object.assign(this, updates);
    },
    async save() {
      return save ? save(this) : this;
    },
    async populate() {
      this.seller = { _id: ownerId, fullName: "Event owner" };
      return this;
    },
    toObject() {
      return Object.fromEntries(
        Object.entries(this).filter(
          ([key]) => !["set", "save", "populate", "toObject"].includes(key),
        ),
      );
    },
    ...overrides,
  };
  return listing;
};

const mockViewerMetadata = (context) => {
  context.mock.method(User, "findById", () => ({
    select: () => ({ lean: async () => ({ savedMarketplaceListings: [] }) }),
  }));
  context.mock.method(MarketplaceListingReport, "find", () => ({
    select: () => ({ lean: async () => [] }),
  }));
};

afterEach(() => mock.restoreAll());

test("unauthenticated update requests are rejected", async () => {
  const res = makeResponse();
  await updateMarketplaceListing(makeRequest({ title: "New event" }, null), res);
  assert.equal(res.statusCode, 401);
});

test("invalid listing IDs are rejected before database access", async () => {
  const req = makeRequest();
  req.params.id = "not-an-object-id";
  const res = makeResponse();
  await updateMarketplaceListing(req, res);
  assert.equal(res.statusCode, 404);
});

test("only the event owner can update event listings", async (context) => {
  let requestedFilter;
  context.mock.method(MarketplaceListing, "findOne", async (filter) => {
    requestedFilter = filter;
    return null;
  });

  const res = makeResponse();
  await updateMarketplaceListing(makeRequest(undefined, otherUserId), res);

  assert.equal(res.statusCode, 404);
  assert.equal(String(requestedFilter._id), listingId.toString());
  assert.equal(String(requestedFilter.seller), otherUserId.toString());
  assert.equal(requestedFilter.type, "event");
});

test("non-event listings cannot use the event update endpoint", async (context) => {
  let requestedFilter;
  context.mock.method(MarketplaceListing, "findOne", async (filter) => {
    requestedFilter = filter;
    return null;
  });

  const res = makeResponse();
  await updateMarketplaceListing(makeRequest(), res);

  assert.equal(res.statusCode, 404);
  assert.equal(requestedFilter.type, "event");
});

test("update rejects attempts to change type, ownership, or moderation state", async (context) => {
  let lookupCount = 0;
  context.mock.method(MarketplaceListing, "findOne", async () => {
    lookupCount += 1;
    return null;
  });

  for (const body of [
    { title: "New event", type: "physical_product" },
    { title: "New event", seller: otherUserId.toString() },
    { title: "New event", status: "active" },
    { title: "New event", isMarketplaceModerator: true },
  ]) {
    const res = makeResponse();
    await updateMarketplaceListing(makeRequest(body), res);
    assert.equal(res.statusCode, 400);
  }
  assert.equal(lookupCount, 0);
});

test("invalid editable field values are rejected before saving", async (context) => {
  let saveCount = 0;
  context.mock.method(MarketplaceListing, "findOne", async () => {
    return makeListingDocument({}, {
      save: async () => {
        saveCount += 1;
      },
    });
  });
  for (const body of [
    { title: "x" },
    { title: 42 },
    { description: "x".repeat(2001) },
    { price: "free" },
    { price: -1 },
    { currency: "US" },
    { imageUrls: Array(6).fill("https://media.example/photo.jpg") },
    { videoUrl: "https://third-party.example/video.mp4" },
    { contactMethod: "external_link", contactUrl: "javascript:alert(1)" },
  ]) {
    const res = makeResponse();
    await updateMarketplaceListing(makeRequest(body), res);
    assert.equal(res.statusCode, 400, JSON.stringify(body));
  }
  assert.equal(saveCount, 0);
});

test("owner update preserves status and reports while returning serialized listing", async (context) => {
  const listing = makeListingDocument();
  let saved;
  let reportReadCount = 0;
  context.mock.method(MarketplaceListing, "findOne", async (filter) => {
    assert.equal(filter.type, "event");
    assert.equal(String(filter.seller), ownerId.toString());
    return listing;
  });
  context.mock.method(listing, "save", async function save() {
    saved = { ...this.toObject() };
    return this;
  });
  context.mock.method(User, "findById", () => ({
    select: () => ({ lean: async () => ({ savedMarketplaceListings: [listingId] }) }),
  }));
  context.mock.method(MarketplaceListingReport, "find", () => {
    reportReadCount += 1;
    return { select: () => ({ lean: async () => [{ listing: listingId }] }) };
  });

  const res = makeResponse();
  await updateMarketplaceListing(
    makeRequest({
      title: "Updated event title",
      description: "Updated details",
      category: "Community music",
      price: 15,
      currency: "eur",
      imageUrls: ["https://media.example/banner.jpg"],
      videoUrl: "https://media.example/event.mp4",
    }),
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.listing.title, "Updated event title");
  assert.equal(res.body.listing.category, "Community music");
  assert.equal(res.body.listing.currency, "EUR");
  assert.equal(res.body.listing.isSaved, true);
  assert.equal(res.body.listing.reportedByMe, true);
  assert.equal(saved.status, "hidden");
  assert.equal(saved.type, "event");
  assert.equal(String(saved.seller), ownerId.toString());
  assert.equal(reportReadCount, 1);
});

test("failed saves leave the stored listing intact and do not trigger media cleanup", async (context) => {
  const persisted = { title: "Original event title", status: "reported" };
  const listing = makeListingDocument({}, {
    save: async () => {
      throw new Error("write failed");
    },
  });
  context.mock.method(MarketplaceListing, "findOne", async () => listing);
  context.mock.method(MarketplaceListingReport, "find", () => {
    throw new Error("No report state should be mutated or required before save");
  });

  const res = makeResponse();
  await updateMarketplaceListing(makeRequest({ title: "New event title" }), res);

  assert.equal(res.statusCode, 500);
  assert.deepEqual(persisted, {
    title: "Original event title",
    status: "reported",
  });
});
