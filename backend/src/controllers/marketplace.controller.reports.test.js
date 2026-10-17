import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import mongoose from "mongoose";
import MarketplaceListing from "../models/MarketplaceListing.js";
import MarketplaceListingReport from "../models/MarketplaceListingReport.js";
import User from "../models/User.js";
import {
  getMarketplaceListings,
  getMarketplaceModerationReports,
  reportMarketplaceListing,
  resolveMarketplaceModerationReport,
  serializeListing,
} from "./marketplace.controller.js";

const listingId = new mongoose.Types.ObjectId("64a000000000000000000100");
const sellerId = new mongoose.Types.ObjectId("64a000000000000000000101");
const reporterA = new mongoose.Types.ObjectId("64a000000000000000000102");
const reporterB = new mongoose.Types.ObjectId("64a000000000000000000103");
const reportId = new mongoose.Types.ObjectId("64a000000000000000000104");

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

const makeReportRequest = (userId, body = { reason: "spam" }) => ({
  params: { id: listingId.toString() },
  body,
  user: { _id: userId },
});

const makeListing = (status = "active") => ({
  _id: listingId,
  seller: sellerId,
  status,
});

afterEach(() => mock.restoreAll());

test("reporting an active listing creates an open report without changing visibility", async (context) => {
  const reports = [];
  const listingUpdates = [];
  context.mock.method(MarketplaceListing, "findOne", () => ({
    select: async () => makeListing("active"),
  }));
  context.mock.method(MarketplaceListingReport, "create", async (report) => {
    reports.push(report);
    return report;
  });
  context.mock.method(MarketplaceListing, "updateOne", async (...args) => {
    listingUpdates.push(args);
  });

  const res = makeResponse();
  await reportMarketplaceListing(makeReportRequest(reporterA), res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.reportedByMe, true);
  assert.equal(reports[0].status, undefined);
  assert.equal(
    MarketplaceListingReport.schema.path("status").getDefault(),
    "open",
  );
  assert.equal(reports[0].listing, listingId);
  assert.equal(reports[0].reporter, reporterA);
  assert.equal(listingUpdates.length, 0);
  assert.equal(makeListing("active").status, "active");
});

test("reporting a legacy `reported` listing does not automatically reactivate it", async (context) => {
  const listingUpdates = [];
  context.mock.method(MarketplaceListing, "findOne", () => ({
    select: async () => makeListing("reported"),
  }));
  context.mock.method(
    MarketplaceListingReport,
    "create",
    async (report) => report,
  );
  context.mock.method(MarketplaceListing, "updateOne", async (...args) => {
    listingUpdates.push(args);
  });

  const res = makeResponse();
  await reportMarketplaceListing(makeReportRequest(reporterA), res);

  assert.equal(res.statusCode, 201);
  assert.equal(listingUpdates.length, 0);
  assert.equal(makeListing("reported").status, "reported");
});

test("different users may file distinct reports; one reporter cannot duplicate their report", async (context) => {
  const reports = [];
  context.mock.method(MarketplaceListing, "findOne", () => ({
    select: async () => makeListing("active"),
  }));
  context.mock.method(MarketplaceListingReport, "create", async (report) => {
    if (reports.some((existing) => existing.reporter.equals(report.reporter))) {
      throw Object.assign(new Error("duplicate report"), { code: 11000 });
    }
    reports.push(report);
    return report;
  });

  const first = makeResponse();
  const second = makeResponse();
  const duplicate = makeResponse();
  await reportMarketplaceListing(makeReportRequest(reporterA), first);
  await reportMarketplaceListing(makeReportRequest(reporterB), second);
  await reportMarketplaceListing(makeReportRequest(reporterA), duplicate);

  assert.equal(first.statusCode, 201);
  assert.equal(second.statusCode, 201);
  assert.equal(duplicate.statusCode, 409);
  assert.equal(reports.length, 2);
});

test("server serialization derives reportedByMe from the viewer report set", () => {
  const listing = {
    _id: listingId,
    status: "active",
    reportedByMe: true,
    imageUrl: "https://images.example/legacy.jpg",
  };

  assert.equal(serializeListing(listing).reportedByMe, false);
  assert.equal(
    serializeListing(listing, new Set(), new Set([listingId.toString()]))
      .reportedByMe,
    true,
  );
});

test("listing refresh returns only the authenticated viewer's report state", async (context) => {
  const listing = { ...makeListing("active"), title: "Visible listing" };
  let requestedFilter;
  context.mock.method(MarketplaceListing, "find", (filter) => {
    requestedFilter = filter;
    return {
      populate() {
        return this;
      },
      sort() {
        return this;
      },
      skip() {
        return this;
      },
      limit() {
        return this;
      },
      lean: async () => [listing],
    };
  });
  context.mock.method(MarketplaceListing, "countDocuments", async () => 1);
  context.mock.method(MarketplaceListing, "distinct", async () => []);
  context.mock.method(User, "findById", () => ({
    select: () => ({ lean: async () => ({ savedMarketplaceListings: [] }) }),
  }));
  context.mock.method(MarketplaceListingReport, "find", (filter) => ({
    select: () => ({
      lean: async () =>
        String(filter.reporter) === reporterA.toString()
          ? [{ listing: listingId }]
          : [],
    }),
  }));

  const ownResult = makeResponse();
  await getMarketplaceListings(
    { query: {}, user: { _id: reporterA } },
    ownResult,
  );
  const unrelatedResult = makeResponse();
  await getMarketplaceListings(
    { query: {}, user: { _id: reporterB } },
    unrelatedResult,
  );

  assert.equal(requestedFilter.status, "active");
  assert.equal(ownResult.body.listings[0].reportedByMe, true);
  assert.equal(unrelatedResult.body.listings[0].reportedByMe, false);
  assert.equal(
    JSON.stringify(unrelatedResult.body).includes("reporter"),
    false,
  );
  assert.equal(
    MarketplaceListingReport.schema.path("status").defaultValue,
    "open",
  );
});

test("moderator dismissal closes only that report and never changes listing visibility", async (context) => {
  const reportUpdates = [];
  const listingUpdates = [];
  context.mock.method(
    MarketplaceListingReport,
    "findOneAndUpdate",
    async (...args) => {
      reportUpdates.push(args);
      return { _id: reportId, listing: listingId, status: "dismissed" };
    },
  );
  context.mock.method(MarketplaceListing, "updateOne", async (...args) => {
    listingUpdates.push(args);
  });

  const res = makeResponse();
  await resolveMarketplaceModerationReport(
    {
      params: { reportId: reportId.toString() },
      body: { decision: "active" },
      user: { isMarketplaceModerator: true },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(reportUpdates[0][0].status, "open");
  assert.equal(reportUpdates[1], undefined);
  assert.equal(listingUpdates.length, 0);
});

test("moderator hide does not reactivate or downgrade a removed listing", async (context) => {
  const listingUpdates = [];
  context.mock.method(
    MarketplaceListingReport,
    "findOneAndUpdate",
    async () => ({
      _id: reportId,
      listing: listingId,
    }),
  );
  context.mock.method(MarketplaceListing, "updateOne", async (...args) => {
    listingUpdates.push(args);
  });

  const res = makeResponse();
  await resolveMarketplaceModerationReport(
    {
      params: { reportId: reportId.toString() },
      body: { decision: "hidden" },
      user: { isMarketplaceModerator: true },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(listingUpdates[0][0], {
    _id: listingId,
    status: { $ne: "removed" },
  });
  assert.deepEqual(listingUpdates[0][1], { $set: { status: "hidden" } });
});

test("moderator removal explicitly removes the listing while resolving its report", async (context) => {
  let listingUpdate;
  context.mock.method(
    MarketplaceListingReport,
    "findOneAndUpdate",
    async () => ({
      _id: reportId,
      listing: listingId,
    }),
  );
  context.mock.method(MarketplaceListing, "updateOne", async (...args) => {
    listingUpdate = args;
  });

  const res = makeResponse();
  await resolveMarketplaceModerationReport(
    {
      params: { reportId: reportId.toString() },
      body: { decision: "removed" },
      user: { isMarketplaceModerator: true },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(listingUpdate[1], { $set: { status: "removed" } });
});

test("non-moderators cannot access the moderator report queue", async () => {
  const res = makeResponse();
  await getMarketplaceModerationReports(
    { user: { isMarketplaceModerator: false } },
    res,
  );
  assert.equal(res.statusCode, 403);
});

test("moderator queue requests only open reports", async (context) => {
  let filter;
  context.mock.method(MarketplaceListingReport, "find", (value) => {
    filter = value;
    return {
      populate() {
        return this;
      },
      sort() {
        return this;
      },
      limit() {
        return this;
      },
      lean: async () => [],
    };
  });
  const res = makeResponse();
  await getMarketplaceModerationReports(
    { user: { isMarketplaceModerator: true } },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(filter, { status: "open" });
  assert.deepEqual(res.body.reports, []);
});
