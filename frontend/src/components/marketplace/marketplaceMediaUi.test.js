import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test, { after, before } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

let vite;
let MarketplaceMediaUploader;
let MarketplaceCard;
let MarketplaceListingGallery;
let ReportedBadge;

before(async () => {
  const frontendRoot = fileURLToPath(new URL("../../../", import.meta.url));
  vite = await createServer({
    configFile: fileURLToPath(
      new URL("../../../vite.config.js", import.meta.url),
    ),
    root: frontendRoot,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error",
  });
  ({ default: MarketplaceMediaUploader } = await vite.ssrLoadModule(
    "/src/components/marketplace/MarketplaceMediaUploader.jsx",
  ));
  ({ MarketplaceCard, MarketplaceListingGallery } = await vite.ssrLoadModule(
    "/src/components/marketplace/MarketplacePanel.jsx",
  ));
  ({ default: ReportedBadge } = await vite.ssrLoadModule(
    "/src/components/marketplace/ReportedBadge.jsx",
  ));
});

after(async () => {
  await vite?.close();
});

const render = (Component, props) =>
  renderToStaticMarkup(createElement(Component, props));

const uploaderProps = {
  images: [],
  video: null,
  onAddImages() {},
  onReplaceImage() {},
  onRemoveImage() {},
  onMoveImage() {},
  onAddVideo() {},
  onRetryVideo() {},
  onRemoveVideo() {},
};

test("photo picker is accessible, multi-select, and has a useful empty state", () => {
  const markup = render(MarketplaceMediaUploader, uploaderProps);
  assert.match(markup, /aria-label="Choose listing photos"/);
  assert.match(markup, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(markup, /multiple=""/);
  assert.match(markup, /Choose photos from your device/);
  assert.match(markup, /Add photos \(0\/5\)/);
});

test("selected images show the primary photo and individual replace/reorder/remove actions", () => {
  const markup = render(MarketplaceMediaUploader, {
    ...uploaderProps,
    images: [
      {
        id: "photo-1",
        file: { name: "photo.webp" },
        previewUrl: "blob:local-photo",
        status: "uploaded",
        progress: 100,
      },
    ],
  });
  assert.match(markup, /src="blob:local-photo"/);
  assert.match(markup, /Primary photo/);
  assert.match(markup, /aria-label="Replace photo 1"/);
  assert.match(markup, /aria-label="Move photo 1 earlier"/);
  assert.match(markup, /aria-label="Remove photo 1"/);
});

test("optional video picker previews controls and upload progress", () => {
  const emptyMarkup = render(MarketplaceMediaUploader, {
    ...uploaderProps,
    allowVideo: true,
  });
  assert.match(emptyMarkup, /accept="video\/mp4,video\/webm"/);
  assert.match(emptyMarkup, /Add video/);

  const markup = render(MarketplaceMediaUploader, {
    ...uploaderProps,
    allowVideo: true,
    video: {
      id: "video-1",
      file: { name: "clip.mp4" },
      previewUrl: "blob:local-video",
      status: "uploading",
      progress: 42,
    },
  });
  assert.match(markup, /src="blob:local-video"/);
  assert.match(markup, /controls=""/);
  assert.match(markup, /preload="metadata"/);
  assert.match(markup, /42%/);
  assert.match(markup, /aria-label="Remove listing video"/);
});

test("shows a clear per-file upload failure instead of hiding the error", () => {
  const markup = render(MarketplaceMediaUploader, {
    ...uploaderProps,
    images: [
      {
        id: "failed-photo",
        file: { name: "broken.png" },
        previewUrl: "blob:broken-photo",
        status: "error",
        progress: 0,
        error: "This image is corrupt or could not be read.",
      },
    ],
  });
  assert.match(markup, /Needs attention/);
  assert.match(markup, /This image is corrupt or could not be read\./);
  assert.match(markup, /role="alert"/);
});

test("a card shows the reported label only when the server marks this viewer", () => {
  const renderCard = (reportedByMe) =>
    renderToStaticMarkup(
      createElement(MarketplaceCard, {
        listing: {
          _id: "listing-1",
          title: "Handmade pottery",
          type: "physical_product",
          category: "Home",
          price: null,
          status: "active",
          reportedByMe,
        },
        onOpen() {},
        onSave() {},
        saving: false,
      }),
    );

  assert.match(renderCard(true), /Reported/);
  assert.doesNotMatch(renderCard(false), /Reported/);
});

test("reported badge is subtle and absent for an unrelated viewer", () => {
  const reportedMarkup = renderToStaticMarkup(
    createElement(ReportedBadge, { reportedByMe: true }),
  );
  const unreportedMarkup = renderToStaticMarkup(
    createElement(ReportedBadge, { reportedByMe: false }),
  );

  assert.match(reportedMarkup, /Reported/);
  assert.match(reportedMarkup, /badge-ghost/);
  assert.equal(unreportedMarkup, "");
});

test("listing detail keeps legacy images and renders optional native video playback", () => {
  const legacyMarkup = render(MarketplaceListingGallery, {
    listing: {
      _id: "legacy",
      title: "Vintage lamp",
      imageUrl: "https://images.example/legacy.jpg",
    },
  });
  assert.match(legacyMarkup, /src="https:\/\/images.example\/legacy.jpg"/);
  assert.match(legacyMarkup, /Vintage lamp photo 1/);

  const markup = render(MarketplaceListingGallery, {
    listing: {
      _id: "video-listing",
      title: "Ceramic demonstration",
      imageUrls: ["https://images.example/item.jpg"],
      videoUrl: "https://media.example/demo.mp4",
    },
  });
  assert.match(markup, /src="https:\/\/media.example\/demo.mp4"/);
  assert.match(markup, /controls=""/);
  assert.match(markup, /playsInline=""/);
  assert.match(markup, /preload="metadata"/);
  assert.match(markup, /Ceramic demonstration listing video/);
  assert.doesNotMatch(markup, /autoplay/);
  assert.doesNotMatch(markup, /preload="auto"/);
});
