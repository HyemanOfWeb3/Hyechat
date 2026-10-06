import mongoose from "mongoose";

const marketplaceListingReportSchema = new mongoose.Schema(
  {
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MarketplaceListing",
      required: true,
      index: true,
    },
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      type: String,
      enum: ["spam", "scam", "inappropriate", "prohibited", "other"],
      required: true,
    },
    details: { type: String, default: "", trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: ["open", "resolved", "dismissed"],
      default: "open",
    },
  },
  { timestamps: true },
);

marketplaceListingReportSchema.index(
  { listing: 1, reporter: 1 },
  { unique: true },
);
marketplaceListingReportSchema.index({ status: 1, createdAt: 1 });

const MarketplaceListingReport = mongoose.model(
  "MarketplaceListingReport",
  marketplaceListingReportSchema,
);

export default MarketplaceListingReport;
