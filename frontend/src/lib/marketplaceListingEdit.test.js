import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMarketplaceEditPayload,
  canEditMarketplaceEvent,
  createMarketplaceEditForm,
  getMarketplaceEditMedia,
  replaceMarketplaceListingInCache,
} from "./marketplaceListingEdit.js";

test("only the owner of an event can edit it", () => {
  const event = { type: "event", seller: { _id: "owner-1" } };
  assert.equal(canEditMarketplaceEvent(event, "owner-1"), true);
  assert.equal(
    canEditMarketplaceEvent({ type: "event", seller: "owner-1" }, "owner-1"),
    true,
  );
  assert.equal(canEditMarketplaceEvent(event, "other-user"), false);
  assert.equal(
    canEditMarketplaceEvent({ ...event, type: "service" }, "owner-1"),
    false,
  );
  assert.equal(canEditMarketplaceEvent(event, null), false);
});

test("edit form is prepopulated from modern and legacy listing fields", () => {
  const form = createMarketplaceEditForm({
    title: "  Community concert  ",
    description: "Doors open at six",
    category: "Music",
    price: 15,
    currency: "USD",
    location: "Downtown",
    contactMethod: "external_link",
    contactUrl: "https://events.example/tickets",
    imageUrl: "https://cdn.example/banner.jpg",
  });
  assert.deepEqual(form, {
    title: "  Community concert  ",
    description: "Doors open at six",
    category: "Music",
    price: "15",
    currency: "USD",
    location: "Downtown",
    contactMethod: "external_link",
    contactUrl: "https://events.example/tickets",
  });
  assert.deepEqual(getMarketplaceEditMedia({ imageUrl: "legacy.jpg" }), {
    imageUrls: ["legacy.jpg"],
    videoUrl: "",
  });
  assert.deepEqual(
    getMarketplaceEditMedia({
      imageUrls: ["first.jpg", "second.jpg"],
      videoUrl: "event-video.mp4",
    }),
    {
      imageUrls: ["first.jpg", "second.jpg"],
      videoUrl: "event-video.mp4",
    },
  );
});

test("edit payload keeps existing and reordered media and supports video removal", () => {
  assert.deepEqual(
    buildMarketplaceEditPayload(
      {
        title: "Concert",
        description: "New details",
        category: "Music",
        price: "12.50",
        currency: "USD",
        location: "Hall",
        contactMethod: "message",
        contactUrl: "ignored",
      },
      {
        images: [
          { url: "https://cdn.example/second.jpg" },
          { url: "https://cdn.example/first.jpg" },
        ],
        video: null,
      },
    ),
    {
      title: "Concert",
      description: "New details",
      category: "Music",
      price: 12.5,
      currency: "USD",
      location: "Hall",
      contactMethod: "message",
      contactUrl: "",
      imageUrls: [
        "https://cdn.example/second.jpg",
        "https://cdn.example/first.jpg",
      ],
      videoUrl: "",
    },
  );
});

test("marketplace cache replacement updates details, pages, saved lists, and reports", () => {
  const listing = { _id: "event-1", title: "Old", status: "hidden" };
  const updated = { _id: "event-1", title: "New", status: "hidden" };
  const queryData = {
    pages: [
      {
        listings: [listing, { _id: "other", title: "Unchanged" }],
        reports: [{ listing }],
      },
    ],
  };
  const next = replaceMarketplaceListingInCache(queryData, "event-1", updated);

  assert.equal(next.pages[0].listings[0].title, "New");
  assert.equal(next.pages[0].listings[0].status, "hidden");
  assert.equal(next.pages[0].reports[0].listing.title, "New");
  assert.equal(next.pages[0].listings[1].title, "Unchanged");
  assert.notEqual(queryData.pages[0].listings[0].title, "New");

  const detail = replaceMarketplaceListingInCache(
    { listing },
    "event-1",
    updated,
  );
  assert.equal(detail.listing.title, "New");

  const saved = replaceMarketplaceListingInCache(
    { listings: [listing] },
    "event-1",
    updated,
  );
  assert.equal(saved.listings[0].title, "New");
});
