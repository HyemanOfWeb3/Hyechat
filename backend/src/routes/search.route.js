import express from "express";
import rateLimit from "express-rate-limit";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  searchCommunities,
  searchMarketplace,
  searchPeople,
} from "../controllers/search.controller.js";

const router = express.Router();
router.use(protectRoute);
router.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
);

router.get("/people", searchPeople);
router.get("/communities", searchCommunities);
router.get("/marketplace", searchMarketplace);

export default router;
