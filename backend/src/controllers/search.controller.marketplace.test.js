import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import MarketplaceListing from "../models/MarketplaceListing.js";
import MarketplaceListingReport from "../models/MarketplaceListingReport.js";
import User from "../models/User.js";
import { searchMarketplace } from "./search.controller.js";

const listingId = new mongoose.Types.ObjectId("64a000000000000000000200");
const sellerId = new mongoose.Types.ObjectId("64a000000000000000000201");
const reporterId = new mongoose.Types.ObjectId("64a000000000000000000202");
const unrelatedId = new mongoose.Types.ObjectId("64a000000000000000000203");

const response = () => ({
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

test("global marketplace search returns a private report flag for the current viewer", async (context) => {
  let listingFilter;
  context.mock.method(User, "findById", () => ({
    select: () => ({ lean: async () => ({ blockedUsers: [] }) }),
  }));
  context.mock.method(User, "find", () => ({ distinct: async () => [] }));
  context.mock.method(MarketplaceListing, "find", (filter) => {
    listingFilter = filter;
    return {
      populate() { return this; },
      sort() { return this; },
      skip() { return this; },
      limit() { return this; },
      lean: async () => [{
        _id: listingId,
        title: "Handmade pottery",
        status: "active",
        seller: { _id: sellerId, fullName: "Seller" },
      }],
    };
  });
  context.mock.method(MarketplaceListing, "countDocuments", async () => 1);
  context.mock.method(MarketplaceListingReport, "find", (filter) => ({
    select: () => ({
      lean: async () =>
        String(filter.reporter) === reporterId.toString()
          ? [{ listing: listingId }]
          : [],
    }),
  }));

  const ownResponse = response();
  await searchMarketplace(
    { query: { query: "pottery" }, user: { _id: reporterId } },
    ownResponse,
  );
  const unrelatedResponse = response();
  await searchMarketplace(
    { query: { query: "pottery" }, user: { _id: unrelatedId } },
    unrelatedResponse,
  );

  assert.equal(listingFilter.status, "active");
  assert.equal(ownResponse.body.results[0].reportedByMe, true);
  assert.equal(unrelatedResponse.body.results[0].reportedByMe, false);
  assert.equal(JSON.stringify(unrelatedResponse.body).includes("reporter"), false);
});
