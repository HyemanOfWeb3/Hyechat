import mongoose from "mongoose";
import Community from "../models/Community.js";
import MarketplaceListing from "../models/MarketplaceListing.js";
import User from "../models/User.js";

const MAX_PAGE_SIZE = 12;
const USER_FIELDS =
  "fullName profilePic bio nativeLanguage learningLanguage interests emailVerified";
const SELLER_FIELDS = "fullName profilePic bio emailVerified";

const parsePaging = (query) => ({
  page: Math.max(1, Number.parseInt(query.page, 10) || 1),
  limit: Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(query.limit, 10) || 8)),
});

const validateQuery = (value) => {
  if (typeof value !== "string") return "Search query is required";
  const query = value.trim();
  if (query.length < 2) return "Enter at least 2 characters to search";
  if (query.length > 100) return "Search query must be 100 characters or fewer";
  return query;
};

const getExcludedUserIds = async (userId) => {
  const user = await User.findById(userId).select("blockedUsers").lean();
  const blockedBy = await User.find({ blockedUsers: userId }).distinct("_id");
  return [
    new mongoose.Types.ObjectId(userId),
    ...(user?.blockedUsers || []),
    ...blockedBy,
  ];
};

const respondWithError = (res, error, message) => {
  console.error(message, error.message);
  return res.status(500).json({ message: "Search is temporarily unavailable" });
};

export async function searchPeople(req, res) {
  const query = validateQuery(req.query.query);
  if (typeof query !== "string") return res.status(400).json({ message: query });

  const { page, limit } = parsePaging(req.query);
  try {
    const excluded = await getExcludedUserIds(req.user._id);
    const filter = {
      $text: { $search: query },
      _id: { $nin: excluded },
      isOnboarded: true,
    };
    const [users, total] = await Promise.all([
      User.find(filter, { score: { $meta: "textScore" } })
        .select(USER_FIELDS)
        .sort({ score: { $meta: "textScore" }, fullName: 1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);
    return res.status(200).json({
      results: users,
      pagination: { page, limit, hasMore: page * limit < total },
    });
  } catch (error) {
    return respondWithError(res, error, "Error searching people");
  }
}

export async function searchCommunities(req, res) {
  const query = validateQuery(req.query.query);
  if (typeof query !== "string") return res.status(400).json({ message: query });

  const { page, limit } = parsePaging(req.query);
  try {
    const excludedOwners = await getExcludedUserIds(req.user._id);
    const filter = {
      $text: { $search: query },
      privacy: "public",
      owner: { $nin: excludedOwners },
    };
    const [communities, total] = await Promise.all([
      Community.find(filter, { score: { $meta: "textScore" } })
        .select("name description avatar category owner members")
        .populate("owner", "fullName profilePic")
        .sort({ score: { $meta: "textScore" }, name: 1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Community.countDocuments(filter),
    ]);
    const currentUserId = req.user._id.toString();
    const results = communities
      .filter((community) => community.owner)
      .map((community) => ({
        _id: community._id,
        name: community.name,
        description: community.description,
        avatar: community.avatar,
        category: community.category,
        memberCount: community.members?.length || 0,
        isMember: (community.members || []).some(
          (member) => member.user.toString() === currentUserId,
        ),
        owner: community.owner,
      }));
    return res.status(200).json({
      results,
      pagination: { page, limit, hasMore: page * limit < total },
    });
  } catch (error) {
    return respondWithError(res, error, "Error searching communities");
  }
}

export async function searchMarketplace(req, res) {
  const query = validateQuery(req.query.query);
  if (typeof query !== "string") return res.status(400).json({ message: query });

  const { page, limit } = parsePaging(req.query);
  try {
    const excludedSellers = await getExcludedUserIds(req.user._id);
    const filter = {
      $text: { $search: query },
      status: "active",
      seller: { $nin: excludedSellers },
    };
    const [listings, total] = await Promise.all([
      MarketplaceListing.find(filter, { score: { $meta: "textScore" } })
        .populate("seller", SELLER_FIELDS)
        .sort({ score: { $meta: "textScore" }, createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      MarketplaceListing.countDocuments(filter),
    ]);
    const results = listings
      .filter((listing) => listing.seller)
      .map((listing) => ({
        ...listing,
        imageUrls: listing.imageUrls?.length
          ? listing.imageUrls
          : listing.imageUrl
            ? [listing.imageUrl]
            : [],
      }));
    return res.status(200).json({
      results,
      pagination: { page, limit, hasMore: page * limit < total },
    });
  } catch (error) {
    return respondWithError(res, error, "Error searching marketplace");
  }
}
