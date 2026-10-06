import mongoose from "mongoose";

export const MARKETPLACE_LISTING_TYPES = [
  "physical_product",
  "digital_product",
  "service",
  "creator_offering",
  "business",
  "course",
  "event",
];

export const MARKETPLACE_LISTING_CONDITIONS = [
  "new",
  "like_new",
  "good",
  "fair",
  "not_applicable",
];

export const MARKETPLACE_LISTING_STATUSES = [
  "active",
  "hidden",
  "reported",
  "removed",
];

const marketplaceListingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 100,
    },
    description: { type: String, default: "", trim: true, maxlength: 2000 },
    type: { type: String, required: true, enum: MARKETPLACE_LISTING_TYPES },
    category: { type: String, default: "Other", trim: true, maxlength: 80 },
    price: { type: Number, default: null, min: 0 },
    currency: {
      type: String,
      default: "USD",
      trim: true,
      uppercase: true,
      maxlength: 3,
    },
    condition: {
      type: String,
      enum: MARKETPLACE_LISTING_CONDITIONS,
      default: "not_applicable",
    },
    imageUrls: {
      type: [{ type: String, trim: true, maxlength: 2048 }],
      default: [],
      validate: [
        (urls) => urls.length <= 5,
        "A listing can have up to 5 images",
      ],
    },
    // Kept for listings created by the first Explore release.
    imageUrl: { type: String, default: "", trim: true, maxlength: 2048 },
    location: { type: String, default: "", trim: true, maxlength: 120 },
    contactMethod: {
      type: String,
      enum: ["message", "external_link"],
      default: "message",
    },
    contactUrl: { type: String, default: "", trim: true, maxlength: 2048 },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: MARKETPLACE_LISTING_STATUSES,
      default: "active",
    },
  },
  { timestamps: true },
);

marketplaceListingSchema.index({ status: 1, createdAt: -1 });
marketplaceListingSchema.index({ type: 1, status: 1, createdAt: -1 });
marketplaceListingSchema.index({ category: 1, status: 1, createdAt: -1 });
marketplaceListingSchema.index({ seller: 1, status: 1, createdAt: -1 });

const MarketplaceListing = mongoose.model(
  "MarketplaceListing",
  marketplaceListingSchema,
);

export default MarketplaceListing;
