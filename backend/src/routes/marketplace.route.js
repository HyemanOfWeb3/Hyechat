import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  createMarketplaceListing,
  getMarketplaceListings,
} from "../controllers/marketplace.controller.js";

const router = express.Router();
router.use(protectRoute);
router.get("/", getMarketplaceListings);
router.post("/", createMarketplaceListing);

export default router;
