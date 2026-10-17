import assert from "node:assert/strict";
import test from "node:test";
import { isMarketplaceMediaReferenced } from "./marketplaceMedia.controller.js";

const modelReturning = (result) => ({ exists: async () => result });

test("cleanup reference check protects media attached to any existing resource", async () => {
  for (const resource of ["listing", "story", "profile", "community"]) {
    const models = {
      listingModel: modelReturning(
        resource === "listing" ? { _id: "listing" } : null,
      ),
      storyModel: modelReturning(
        resource === "story" ? { _id: "story" } : null,
      ),
      userModel: modelReturning(
        resource === "profile" ? { _id: "user" } : null,
      ),
      communityModel: modelReturning(
        resource === "community" ? { _id: "community" } : null,
      ),
    };

    assert.equal(
      await isMarketplaceMediaReferenced("https://blob.example/media", models),
      true,
      `${resource} media must not be deleted`,
    );
  }
});

test("cleanup reference check permits deletion only when no resource uses the blob", async () => {
  const models = {
    listingModel: modelReturning(null),
    storyModel: modelReturning(null),
    userModel: modelReturning(null),
    communityModel: modelReturning(null),
  };

  assert.equal(
    await isMarketplaceMediaReferenced("https://blob.example/media", models),
    false,
  );
});
