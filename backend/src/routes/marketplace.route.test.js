import assert from "node:assert/strict";
import test from "node:test";
import router from "./marketplace.route.js";
import { protectRoute } from "../middleware/auth.middleware.js";

test("event listing updates are routed behind marketplace authentication", () => {
  const protectionIndex = router.stack.findIndex(
    (layer) => layer.handle === protectRoute,
  );
  const updateIndex = router.stack.findIndex(
    (layer) =>
      layer.route?.path === "/:id" && layer.route.methods.patch === true,
  );

  assert.ok(protectionIndex >= 0);
  assert.ok(updateIndex > protectionIndex);
});
