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

const marketplaceListingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
    description: { type: String, default: "", trim: true, maxlength: 2000 },
    type: { type: String, required: true, enum: MARKETPLACE_LISTING_TYPES },
    category: { type: String, default: "", trim: true, maxlength: 60 },
    price: { type: Number, default: null, min: 0 },
    currency: { type: String, default: "USD", trim: true, uppercase: true, maxlength: 3 },
    imageUrl: { type: String, default: "", trim: true, maxlength: 2048 },
    location: { type: String, default: "", trim: true, maxlength: 120 },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["active", "archived"], default: "active" },
  },
  { timestamps: true },
);

marketplaceListingSchema.index({ status: 1, createdAt: -1 });
marketplaceListingSchema.index({ type: 1, status: 1, createdAt: -1 });

const MarketplaceListing = mongoose.model(
  "MarketplaceListing",
  marketplaceListingSchema,
);

export default MarketplaceListing;
