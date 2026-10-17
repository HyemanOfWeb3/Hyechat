import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test, { after, before } from "node:test";
import { createServer } from "vite";

let vite;
let axiosInstance;
let updateMarketplaceListing;

before(async () => {
  const frontendRoot = fileURLToPath(new URL("../../", import.meta.url));
  vite = await createServer({
    configFile: fileURLToPath(new URL("../../vite.config.js", import.meta.url)),
    root: frontendRoot,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error",
  });
  ({ axiosInstance } = await vite.ssrLoadModule("/src/lib/axios.js"));
  ({ updateMarketplaceListing } = await vite.ssrLoadModule("/src/lib/api.js"));
});

after(async () => {
  await vite?.close();
});

test("marketplace edit uses the existing authenticated listing API", async (context) => {
  let request;
  context.mock.method(axiosInstance, "patch", async (...args) => {
    request = args;
    return { data: { success: true, listing: { _id: "event-1" } } };
  });

  const payload = { title: "Updated event", imageUrls: [] };
  const result = await updateMarketplaceListing("event-1", payload);

  assert.deepEqual(request, ["/marketplace/event-1", payload]);
  assert.deepEqual(result, { success: true, listing: { _id: "event-1" } });
});
