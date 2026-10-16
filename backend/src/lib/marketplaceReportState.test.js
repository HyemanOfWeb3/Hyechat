import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { getReportedMarketplaceListingIds } from "./marketplaceReportState.js";

const id = (hex) => new mongoose.Types.ObjectId(hex);

test("loads only report IDs for the authenticated viewer and requested listing page", async () => {
  const reporter = id("64a000000000000000000001");
  const listingA = id("64a000000000000000000002");
  const listingB = id("64a000000000000000000003");
  let query;
  const reportModel = {
    find(filter) {
      query = filter;
      return {
        select(selection) {
          assert.equal(selection, "listing");
          return {
            lean: async () => [{ listing: listingA }],
          };
        },
      };
    },
  };

  const result = await getReportedMarketplaceListingIds(
    reporter,
    [{ _id: listingA }, { _id: listingB }],
    { reportModel },
  );

  assert.equal(query.reporter, reporter);
  assert.deepEqual(query.listing.$in, [listingA, listingB]);
  assert.deepEqual(result, new Set([listingA.toString()]));
});

test("does not query report state for an empty listing page", async () => {
  let queried = false;
  const reportModel = { find: () => { queried = true; } };

  assert.deepEqual(
    await getReportedMarketplaceListingIds("user-1", [], { reportModel }),
    new Set(),
  );
  assert.equal(queried, false);
});
