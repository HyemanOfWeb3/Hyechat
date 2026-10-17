import mongoose from "mongoose";
import MarketplaceListing, {
  MARKETPLACE_LISTING_CONDITIONS,
  MARKETPLACE_LISTING_STATUSES,
  MARKETPLACE_LISTING_TYPES,
} from "../models/MarketplaceListing.js";
import MarketplaceListingReport from "../models/MarketplaceListingReport.js";
import User from "../models/User.js";
import {
  MAX_MARKETPLACE_IMAGES,
  verifyMarketplaceMediaUrl,
} from "../lib/marketplaceMedia.js";
import { getReportedMarketplaceListingIds } from "../lib/marketplaceReportState.js";

const MAX_PAGE_SIZE = 24;
const REPORT_REASONS = ["spam", "scam", "inappropriate", "prohibited", "other"];
const sellerProjection = "fullName profilePic bio emailVerified";
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const pageValues = (query) => ({
  page: Math.max(1, Number.parseInt(query.page, 10) || 1),
  limit: Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.parseInt(query.limit, 10) || 20),
  ),
});
const imageListFor = (listing) =>
  listing.imageUrls?.length
    ? listing.imageUrls
    : listing.imageUrl
      ? [listing.imageUrl]
      : [];
const isModerator = (user) => Boolean(user?.isMarketplaceModerator);
const isValidHttpUrl = (value) => {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

const validateSearchFilters = (query) => {
  const type = typeof query.type === "string" ? query.type : "";
  const minimum =
    query.minPrice === undefined || query.minPrice === ""
      ? null
      : Number(query.minPrice);
  const maximum =
    query.maxPrice === undefined || query.maxPrice === ""
      ? null
      : Number(query.maxPrice);

  if (type && !MARKETPLACE_LISTING_TYPES.includes(type)) {
    return { error: "Invalid marketplace listing type" };
  }
  if (minimum !== null && (!Number.isFinite(minimum) || minimum < 0)) {
    return { error: "Minimum price must be a non-negative number" };
  }
  if (maximum !== null && (!Number.isFinite(maximum) || maximum < 0)) {
    return { error: "Maximum price must be a non-negative number" };
  }
  if (minimum !== null && maximum !== null && minimum > maximum) {
    return { error: "Minimum price cannot exceed maximum price" };
  }

  return { type, minimum, maximum };
};

const buildActiveListingFilter = async (query) => {
  const { error, type, minimum, maximum } = validateSearchFilters(query);
  if (error) return { error };

  const filter = { status: "active" };
  if (type) filter.type = type;
  if (typeof query.category === "string" && query.category.trim()) {
    filter.category = {
      $regex: `^${escapeRegex(query.category.trim())}$`,
      $options: "i",
    };
  }
  if (typeof query.location === "string" && query.location.trim()) {
    filter.location = {
      $regex: escapeRegex(query.location.trim()),
      $options: "i",
    };
  }
  if (minimum !== null || maximum !== null) {
    filter.price = {};
    if (minimum !== null) filter.price.$gte = minimum;
    if (maximum !== null) filter.price.$lte = maximum;
  }
  if (typeof query.query === "string" && query.query.trim()) {
    const search = { $regex: escapeRegex(query.query.trim()), $options: "i" };
    filter.$or = [
      { title: search },
      { description: search },
      { category: search },
      { type: search },
      { location: search },
    ];
  }
  if (typeof query.seller === "string" && query.seller.trim()) {
    const sellerSearch = query.seller.trim();
    if (mongoose.isValidObjectId(sellerSearch)) {
      filter.seller = sellerSearch;
    } else {
      const sellers = await User.find({
        fullName: { $regex: escapeRegex(sellerSearch), $options: "i" },
      }).distinct("_id");
      filter.seller = { $in: sellers };
    }
  }

  return { filter };
};

export const serializeListing = (
  listing,
  savedIds = new Set(),
  reportedIds = new Set(),
) => ({
  ...listing,
  imageUrls: imageListFor(listing),
  isSaved: savedIds.has(listing._id.toString()),
  reportedByMe: reportedIds.has(listing._id.toString()),
});

const getSavedIds = async (userId) => {
  const user = await User.findById(userId)
    .select("savedMarketplaceListings")
    .lean();
  return new Set(
    (user?.savedMarketplaceListings || []).map((id) => id.toString()),
  );
};

export async function getMarketplaceListings(req, res) {
  const { page, limit } = pageValues(req.query);
  try {
    const { error, filter } = await buildActiveListingFilter(req.query);
    if (error) return res.status(400).json({ message: error });

    const [listings, total, categories, savedIds] = await Promise.all([
      MarketplaceListing.find(filter)
        .populate("seller", sellerProjection)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      MarketplaceListing.countDocuments(filter),
      MarketplaceListing.distinct("category", { status: "active" }),
      getSavedIds(req.user._id),
    ]);
    const reportedIds = await getReportedMarketplaceListingIds(
      req.user._id,
      listings,
    );
    const visibleListings = listings
      .filter((listing) => listing.seller)
      .map((listing) => serializeListing(listing, savedIds, reportedIds));

    return res.status(200).json({
      listings: visibleListings,
      categories: categories.filter(Boolean).sort((a, b) => a.localeCompare(b)),
      pagination: { page, limit, hasMore: page * limit < total },
    });
  } catch (error) {
    console.error("Error getting marketplace listings", error.message);
    return res
      .status(500)
      .json({ message: "Unable to load marketplace listings" });
  }
}

export async function getMarketplaceCategories(_req, res) {
  try {
    const categories = await MarketplaceListing.distinct("category", {
      status: "active",
    });
    return res.status(200).json({
      categories: categories.filter(Boolean).sort((a, b) => a.localeCompare(b)),
    });
  } catch (error) {
    console.error("Error getting marketplace categories", error.message);
    return res.status(500).json({ message: "Unable to load categories" });
  }
}

export async function getMyMarketplaceListings(req, res) {
  const { page, limit } = pageValues(req.query);
  try {
    const filter = { seller: req.user._id };
    const [listings, total] = await Promise.all([
      MarketplaceListing.find(filter)
        .sort({ updatedAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      MarketplaceListing.countDocuments(filter),
    ]);
    const reportedIds = await getReportedMarketplaceListingIds(
      req.user._id,
      listings,
    );
    return res.status(200).json({
      listings: listings.map((listing) =>
        serializeListing(listing, new Set(), reportedIds),
      ),
      pagination: { page, limit, hasMore: page * limit < total },
    });
  } catch (error) {
    console.error("Error getting seller listings", error.message);
    return res.status(500).json({ message: "Unable to load your listings" });
  }
}

export async function getSavedMarketplaceListingIds(req, res) {
  try {
    const savedIds = await getSavedIds(req.user._id);
    return res.status(200).json({ listingIds: [...savedIds] });
  } catch (error) {
    console.error("Error getting saved listings", error.message);
    return res.status(500).json({ message: "Unable to load saved listings" });
  }
}

export async function getSavedMarketplaceListings(req, res) {
  const { page, limit } = pageValues(req.query);
  try {
    const user = await User.findById(req.user._id)
      .select("savedMarketplaceListings")
      .lean();
    const ids = user?.savedMarketplaceListings || [];
    const [listings, total] = await Promise.all([
      MarketplaceListing.find({
        _id: { $in: ids },
        status: "active",
      })
        .populate("seller", sellerProjection)
        .sort({ updatedAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      MarketplaceListing.countDocuments({
        _id: { $in: ids },
        status: "active",
      }),
    ]);
    const visibleListings = listings.filter((listing) => listing.seller);
    const reportedIds = await getReportedMarketplaceListingIds(
      req.user._id,
      visibleListings,
    );
    return res.status(200).json({
      listings: visibleListings.map((listing) =>
        serializeListing(listing, new Set(ids.map(String)), reportedIds),
      ),
      pagination: { page, limit, hasMore: page * limit < total },
    });
  } catch (error) {
    console.error("Error getting saved listings", error.message);
    return res.status(500).json({ message: "Unable to load saved listings" });
  }
}

export async function getMarketplaceListing(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: "Listing not found" });
  }
  try {
    const listing = await MarketplaceListing.findById(req.params.id)
      .populate("seller", sellerProjection)
      .lean();
    if (!listing || !listing.seller) {
      return res.status(404).json({ message: "Listing not found" });
    }
    const isOwner = listing.seller._id.toString() === req.user._id.toString();
    if (listing.status !== "active" && !isOwner && !isModerator(req.user)) {
      return res.status(404).json({ message: "Listing not found" });
    }
    const [savedIds, reportedIds] = await Promise.all([
      getSavedIds(req.user._id),
      getReportedMarketplaceListingIds(req.user._id, [listing]),
    ]);
    return res.status(200).json({
      listing: serializeListing(listing, savedIds, reportedIds),
    });
  } catch (error) {
    console.error("Error getting marketplace listing", error.message);
    return res.status(500).json({ message: "Unable to load listing" });
  }
}

export async function createMarketplaceListing(req, res) {
  const {
    title,
    description = "",
    type,
    category,
    price = null,
    currency = "USD",
    condition = "not_applicable",
    imageUrls = [],
    imageUrl = "",
    videoUrl = "",
    location = "",
    contactMethod = "message",
    contactUrl = "",
  } = req.body || {};

  if (
    typeof title !== "string" ||
    title.trim().length < 3 ||
    title.trim().length > 100
  ) {
    return res
      .status(400)
      .json({ message: "Title must be between 3 and 100 characters" });
  }
  if (!MARKETPLACE_LISTING_TYPES.includes(type)) {
    return res.status(400).json({ message: "Choose a valid listing type" });
  }
  if (typeof description !== "string" || description.length > 2000) {
    return res
      .status(400)
      .json({ message: "Description must be 2000 characters or fewer" });
  }
  if (
    price !== null &&
    price !== "" &&
    (!Number.isFinite(Number(price)) || Number(price) < 0)
  ) {
    return res
      .status(400)
      .json({ message: "Price must be a non-negative number" });
  }
  if (typeof category !== "string" || !category.trim()) {
    return res.status(400).json({ message: "Category is required" });
  }
  if (category.trim().length > 80) {
    return res
      .status(400)
      .json({ message: "Category must be 80 characters or fewer" });
  }
  if (typeof currency !== "string" || !/^[a-z]{3}$/i.test(currency.trim())) {
    return res
      .status(400)
      .json({ message: "Currency must be a 3-letter code" });
  }
  if (!MARKETPLACE_LISTING_CONDITIONS.includes(condition)) {
    return res.status(400).json({ message: "Choose a valid item condition" });
  }
  if (type !== "physical_product" && condition !== "not_applicable") {
    return res.status(400).json({
      message: "Condition only applies to physical products",
    });
  }
  if (typeof location !== "string" || location.length > 120) {
    return res
      .status(400)
      .json({ message: "Location must be 120 characters or fewer" });
  }
  if (!Array.isArray(imageUrls) || imageUrls.length > MAX_MARKETPLACE_IMAGES) {
    return res.status(400).json({
      message: `Add up to ${MAX_MARKETPLACE_IMAGES} listing photos`,
    });
  }
  if (
    imageUrls.some((url) => typeof url !== "string") ||
    (imageUrl && typeof imageUrl !== "string")
  ) {
    return res.status(400).json({ message: "Image URLs must be text values" });
  }
  const normalizedImageUrls = [
    ...new Set(
      [...imageUrls, ...(imageUrl ? [imageUrl] : [])]
        .filter((url) => typeof url === "string")
        .map((url) => url.trim())
        .filter(Boolean),
    ),
  ];
  if (
    normalizedImageUrls.length > MAX_MARKETPLACE_IMAGES ||
    normalizedImageUrls.some((url) => url.length > 2048)
  ) {
    return res.status(400).json({
      message: `Add up to ${MAX_MARKETPLACE_IMAGES} listing photos`,
    });
  }
  if (typeof videoUrl !== "string" || videoUrl.length > 2048) {
    return res
      .status(400)
      .json({ message: "Marketplace video URL is invalid" });
  }
  if (!["message", "external_link"].includes(contactMethod)) {
    return res.status(400).json({ message: "Choose a valid contact method" });
  }
  if (contactMethod === "external_link" && !isValidHttpUrl(contactUrl)) {
    return res
      .status(400)
      .json({ message: "External contact links must use HTTP or HTTPS" });
  }
  if (
    contactUrl &&
    (typeof contactUrl !== "string" || contactUrl.length > 2048)
  ) {
    return res.status(400).json({ message: "Contact link is too long" });
  }

  const verifiedImageUrls = [];
  let verifiedVideoUrl = "";
  try {
    for (const imageUrlToVerify of normalizedImageUrls) {
      const media = await verifyMarketplaceMediaUrl(
        imageUrlToVerify,
        req.user._id.toString(),
        "image",
      );
      verifiedImageUrls.push(media.url);
    }
    if (videoUrl.trim()) {
      const media = await verifyMarketplaceMediaUrl(
        videoUrl.trim(),
        req.user._id.toString(),
        "video",
      );
      verifiedVideoUrl = media.url;
    }
  } catch (error) {
    return res.status(error?.statusCode || 400).json({
      message: error?.message || "Marketplace media could not be verified",
    });
  }

  try {
    const listing = await MarketplaceListing.create({
      title: title.trim(),
      description: description.trim(),
      type,
      category: category.trim(),
      price: price === null || price === "" ? null : Number(price),
      currency: currency.trim().toUpperCase(),
      condition,
      imageUrls: verifiedImageUrls,
      videoUrl: verifiedVideoUrl,
      location: location.trim(),
      contactMethod,
      contactUrl: contactMethod === "external_link" ? contactUrl.trim() : "",
      seller: req.user._id,
    });
    await listing.populate("seller", sellerProjection);
    return res.status(201).json({ success: true, listing });
  } catch (error) {
    console.error("Error creating marketplace listing", error.message);
    return res
      .status(500)
      .json({ message: "Unable to create marketplace listing" });
  }
}

export async function saveMarketplaceListing(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: "Listing not found" });
  }
  try {
    const listing = await MarketplaceListing.findOne({
      _id: req.params.id,
      status: "active",
    }).select("seller");
    if (!listing) return res.status(404).json({ message: "Listing not found" });
    if (listing.seller.toString() === req.user._id.toString()) {
      return res
        .status(400)
        .json({ message: "You cannot save your own listing" });
    }
    await User.updateOne(
      { _id: req.user._id },
      { $addToSet: { savedMarketplaceListings: listing._id } },
    );
    return res.status(200).json({ success: true, saved: true });
  } catch (error) {
    console.error("Error saving marketplace listing", error.message);
    return res.status(500).json({ message: "Unable to save listing" });
  }
}

export async function unsaveMarketplaceListing(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: "Listing not found" });
  }
  try {
    await User.updateOne(
      { _id: req.user._id },
      { $pull: { savedMarketplaceListings: req.params.id } },
    );
    return res.status(200).json({ success: true, saved: false });
  } catch (error) {
    console.error("Error unsaving marketplace listing", error.message);
    return res.status(500).json({ message: "Unable to remove saved listing" });
  }
}

export async function reportMarketplaceListing(req, res) {
  const { reason, details = "" } = req.body || {};
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: "Listing not found" });
  }
  if (!REPORT_REASONS.includes(reason)) {
    return res.status(400).json({ message: "Choose a valid report reason" });
  }
  if (typeof details !== "string" || details.length > 500) {
    return res
      .status(400)
      .json({ message: "Report details must be 500 characters or fewer" });
  }

  try {
    const listing = await MarketplaceListing.findOne({
      _id: req.params.id,
      status: { $in: ["active", "reported"] },
    }).select("seller status");
    if (!listing) return res.status(404).json({ message: "Listing not found" });
    if (listing.seller.toString() === req.user._id.toString()) {
      return res
        .status(400)
        .json({ message: "You cannot report your own listing" });
    }
    await MarketplaceListingReport.create({
      listing: listing._id,
      reporter: req.user._id,
      reason,
      details: details.trim(),
    });
    return res.status(201).json({
      success: true,
      reportedByMe: true,
      message: "Report submitted",
    });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: "You have already reported this listing" });
    }
    console.error("Error reporting marketplace listing", error.message);
    return res.status(500).json({ message: "Unable to report listing" });
  }
}

export async function updateMarketplaceListingStatus(req, res) {
  const { status } = req.body || {};
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: "Listing not found" });
  }
  if (!MARKETPLACE_LISTING_STATUSES.includes(status)) {
    return res.status(400).json({ message: "Choose a valid moderation state" });
  }

  try {
    const listing = await MarketplaceListing.findById(req.params.id);
    if (!listing) return res.status(404).json({ message: "Listing not found" });
    const owner = listing.seller.toString() === req.user._id.toString();
    const moderator = isModerator(req.user);
    if (!owner && !moderator) {
      return res
        .status(403)
        .json({ message: "You cannot manage this listing" });
    }
    if (
      owner &&
      !moderator &&
      status === "active" &&
      (await MarketplaceListingReport.countDocuments({
        listing: listing._id,
        status: "open",
      })) > 0
    ) {
      return res.status(403).json({
        message:
          "A moderator must review open reports before this listing is shown again",
      });
    }
    if (!moderator) {
      const ownerAllowed =
        status === "removed" ||
        (status === "hidden" && listing.status !== "removed") ||
        (status === "active" && listing.status === "hidden");
      if (!ownerAllowed) {
        return res.status(403).json({
          message: "Only a moderator can change this moderation state",
        });
      }
    }
    listing.status = status;
    await listing.save();
    return res.status(200).json({ success: true, listing });
  } catch (error) {
    console.error("Error updating marketplace listing state", error.message);
    return res.status(500).json({ message: "Unable to update listing" });
  }
}

export async function getMarketplaceModerationReports(req, res) {
  if (!isModerator(req.user)) {
    return res
      .status(403)
      .json({ message: "Marketplace moderator access required" });
  }
  try {
    const reports = await MarketplaceListingReport.find({ status: "open" })
      .populate({
        path: "listing",
        populate: { path: "seller", select: sellerProjection },
      })
      .populate("reporter", "fullName profilePic")
      .sort({ createdAt: 1 })
      .limit(100)
      .lean();
    return res.status(200).json({ reports });
  } catch (error) {
    console.error("Error getting marketplace reports", error.message);
    return res.status(500).json({ message: "Unable to load reports" });
  }
}

export async function resolveMarketplaceModerationReport(req, res) {
  if (!isModerator(req.user)) {
    return res
      .status(403)
      .json({ message: "Marketplace moderator access required" });
  }
  const { decision } = req.body || {};
  if (!["active", "hidden", "removed"].includes(decision)) {
    return res
      .status(400)
      .json({ message: "Choose active, hidden, or removed" });
  }
  if (!mongoose.isValidObjectId(req.params.reportId)) {
    return res.status(404).json({ message: "Report not found" });
  }
  try {
    const report = await MarketplaceListingReport.findOneAndUpdate(
      { _id: req.params.reportId, status: "open" },
      { $set: { status: decision === "active" ? "dismissed" : "resolved" } },
      { new: true },
    );
    if (!report)
      return res.status(404).json({ message: "Open report not found" });
    if (decision === "removed") {
      await MarketplaceListing.updateOne(
        { _id: report.listing },
        { $set: { status: "removed" } },
      );
    } else if (decision === "hidden") {
      await MarketplaceListing.updateOne(
        { _id: report.listing, status: { $ne: "removed" } },
        { $set: { status: "hidden" } },
      );
    }
    return res.status(200).json({ success: true, decision });
  } catch (error) {
    console.error("Error resolving marketplace report", error.message);
    return res.status(500).json({ message: "Unable to resolve report" });
  }
}
