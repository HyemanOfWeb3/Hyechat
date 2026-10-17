import express from "express";
import rateLimit from "express-rate-limit";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  authenticateMarketplaceUploadRequest,
  cleanupMarketplaceMedia,
  handleMarketplaceMediaUpload,
} from "../controllers/marketplaceMedia.controller.js";
import {
  createMarketplaceListing,
  getMarketplaceCategories,
  getMarketplaceListing,
  getMarketplaceListings,
  getMarketplaceModerationReports,
  getMyMarketplaceListings,
  getSavedMarketplaceListingIds,
  getSavedMarketplaceListings,
  reportMarketplaceListing,
  resolveMarketplaceModerationReport,
  saveMarketplaceListing,
  unsaveMarketplaceListing,
  updateMarketplaceListing,
  updateMarketplaceListingStatus,
} from "../controllers/marketplace.controller.js";

const router = express.Router();
const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});
const marketplaceUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: (req) => req.body?.type === "blob.upload-completed",
});

// Blob completion callbacks are authenticated by handleUploadPresigned's
// signature verification; token issuance requests still require the JWT.
router.post(
  "/media/upload",
  marketplaceUploadLimiter,
  authenticateMarketplaceUploadRequest,
  handleMarketplaceMediaUpload,
);
router.use(protectRoute);
router.post("/media/cleanup", cleanupMarketplaceMedia);
router.get("/categories", getMarketplaceCategories);
router.get("/saved/ids", getSavedMarketplaceListingIds);
router.get("/saved", getSavedMarketplaceListings);
router.get("/mine", getMyMarketplaceListings);
router.get("/moderation/reports", getMarketplaceModerationReports);
router.patch(
  "/moderation/reports/:reportId",
  resolveMarketplaceModerationReport,
);
router.get("/", getMarketplaceListings);
router.post("/", createMarketplaceListing);
router.get("/:id", getMarketplaceListing);
router.patch("/:id", updateMarketplaceListing);
router.patch("/:id/status", updateMarketplaceListingStatus);
router.post("/:id/save", saveMarketplaceListing);
router.delete("/:id/save", unsaveMarketplaceListing);
router.post("/:id/report", reportLimiter, reportMarketplaceListing);

export default router;
