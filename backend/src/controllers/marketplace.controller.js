import MarketplaceListing, {
  MARKETPLACE_LISTING_TYPES,
} from "../models/MarketplaceListing.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const sellerProjection = "fullName profilePic nativeLanguage learningLanguage";

export async function getMarketplaceListings(req, res) {
  const query = typeof req.query.query === "string" ? req.query.query.trim() : "";
  const type = typeof req.query.type === "string" ? req.query.type : "";
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));

  if (type && !MARKETPLACE_LISTING_TYPES.includes(type)) {
    return res.status(400).json({ message: "Invalid marketplace listing type" });
  }

  const filter = { status: "active" };
  if (type) filter.type = type;
  if (query) {
    const search = { $regex: escapeRegex(query), $options: "i" };
    filter.$or = [
      { title: search },
      { description: search },
      { category: search },
      { type: search },
      { location: search },
    ];
  }

  try {
    const [listings, total] = await Promise.all([
      MarketplaceListing.find(filter)
        .populate("seller", sellerProjection)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      MarketplaceListing.countDocuments(filter),
    ]);

    return res.status(200).json({
      listings,
      pagination: { page, limit, hasMore: page * limit < total },
    });
  } catch (error) {
    console.error("Error getting marketplace listings", error.message);
    return res.status(500).json({ message: "Unable to load marketplace listings" });
  }
}

export async function createMarketplaceListing(req, res) {
  const {
    title,
    description = "",
    type,
    category = "",
    price = null,
    currency = "USD",
    imageUrl = "",
    location = "",
  } = req.body || {};

  if (typeof title !== "string" || title.trim().length < 3 || title.trim().length > 100) {
    return res.status(400).json({ message: "Title must be between 3 and 100 characters" });
  }
  if (!MARKETPLACE_LISTING_TYPES.includes(type)) {
    return res.status(400).json({ message: "Choose a valid listing type" });
  }
  if (typeof description !== "string" || description.length > 2000) {
    return res.status(400).json({ message: "Description must be 2000 characters or fewer" });
  }
  if (price !== null && (!Number.isFinite(Number(price)) || Number(price) < 0)) {
    return res.status(400).json({ message: "Price must be a non-negative number" });
  }
  if (typeof category !== "string" || category.length > 60) {
    return res.status(400).json({ message: "Category must be 60 characters or fewer" });
  }
  if (typeof currency !== "string" || !/^[a-z]{3}$/i.test(currency.trim())) {
    return res.status(400).json({ message: "Currency must be a 3-letter code" });
  }
  if (typeof location !== "string" || location.length > 120) {
    return res.status(400).json({ message: "Location must be 120 characters or fewer" });
  }
  if (imageUrl && (typeof imageUrl !== "string" || imageUrl.length > 2048 || !/^https?:\/\/.+/i.test(imageUrl))) {
    return res.status(400).json({ message: "Image URL must use HTTP or HTTPS" });
  }

  try {
    const listing = await MarketplaceListing.create({
      title: title.trim(),
      description: description.trim(),
      type,
      category: typeof category === "string" ? category.trim() : "",
      price: price === null || price === "" ? null : Number(price),
      currency: typeof currency === "string" ? currency.trim().toUpperCase() : "USD",
      imageUrl: typeof imageUrl === "string" ? imageUrl.trim() : "",
      location: typeof location === "string" ? location.trim() : "",
      seller: req.user._id,
    });
    await listing.populate("seller", sellerProjection);
    return res.status(201).json({ success: true, listing });
  } catch (error) {
    console.error("Error creating marketplace listing", error.message);
    return res.status(500).json({ message: "Unable to create marketplace listing" });
  }
}
