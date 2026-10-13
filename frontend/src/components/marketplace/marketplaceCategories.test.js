import assert from "node:assert/strict";
import test from "node:test";
import {
  MARKETPLACE_CATEGORY_OPTIONS,
  getMarketplaceCategoryOptions,
  resolveMarketplaceCategory,
  selectMarketplaceListingType,
} from "./marketplaceCategories.js";

const expectedCategories = {
  physical_product: [
    "Clothing & Accessories",
    "Electronics",
    "Home & Living",
    "Books & Media",
    "Handmade & Crafts",
    "Beauty & Personal Care",
    "Sports & Outdoors",
    "Food & Groceries",
    "Other",
  ],
  digital_product: [
    "Software & Apps",
    "Templates & Design Assets",
    "E-books & Guides",
    "Digital Art & Graphics",
    "Audio & Video",
    "Digital Downloads",
    "Other",
  ],
  service: [
    "Technology & Development",
    "Design & Creative",
    "Writing & Content",
    "Language Tutoring",
    "Translation",
    "Education & Tutoring",
    "Business & Consulting",
    "Marketing",
    "Local & Personal Services",
    "Other",
  ],
  creator_offering: [
    "Content Creation",
    "Graphic Design",
    "Photography & Video",
    "Digital Art",
    "Writing & Publishing",
    "Community & Membership",
    "Other",
  ],
  business: [
    "Retail",
    "Food & Hospitality",
    "Professional Services",
    "Local Business",
    "Wholesale & Distribution",
    "Agriculture",
    "Other",
  ],
  course: [
    "Technology & Programming",
    "Business & Entrepreneurship",
    "Language Learning",
    "Academic Tutoring",
    "Career Development",
    "Arts & Creative Skills",
    "Other",
  ],
  event: [
    "Workshops & Training",
    "Conferences",
    "Networking",
    "Cultural & Community Events",
    "Entertainment",
    "Online Events",
    "Other",
  ],
};

test("provides suggestions for all seven existing listing types", () => {
  assert.deepEqual(MARKETPLACE_CATEGORY_OPTIONS, expectedCategories);
  assert.deepEqual(
    Object.keys(MARKETPLACE_CATEGORY_OPTIONS),
    Object.keys(expectedCategories),
  );
  assert.deepEqual(getMarketplaceCategoryOptions("unknown_type"), []);
});

test("resolves predefined categories into the existing category value", () => {
  assert.deepEqual(
    resolveMarketplaceCategory(" Language Tutoring "),
    { category: "Language Tutoring", error: "" },
  );
});

test("resolves a trimmed custom category selected through Other", () => {
  assert.deepEqual(resolveMarketplaceCategory("Other", "  Ceramics  "), {
    category: "Ceramics",
    error: "",
  });
});

test("rejects empty, whitespace-only, and overlong custom categories", () => {
  assert.match(resolveMarketplaceCategory("Other", "").error, /Enter a category/);
  assert.match(
    resolveMarketplaceCategory("Other", "   ").error,
    /Enter a category/,
  );
  assert.match(
    resolveMarketplaceCategory("Other", "x".repeat(81)).error,
    /80 characters/,
  );
  assert.deepEqual(resolveMarketplaceCategory("Other", ` ${"x".repeat(80)} `), {
    category: "x".repeat(80),
    error: "",
  });
});

test("changing type clears the previous category and custom text", () => {
  const listing = {
    type: "physical_product",
    category: "Electronics",
    customCategory: "",
    condition: "good",
  };

  assert.deepEqual(selectMarketplaceListingType(listing, "service"), {
    type: "service",
    category: "",
    customCategory: "",
    condition: "not_applicable",
  });
});