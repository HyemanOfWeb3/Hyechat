import { MAX_MARKETPLACE_IMAGES } from "./marketplaceMedia.js";

const EDITABLE_FIELDS = new Set([
  "title",
  "description",
  "category",
  "price",
  "currency",
  "imageUrls",
  "videoUrl",
  "location",
  "contactMethod",
  "contactUrl",
]);

const isValidHttpUrl = (value) => {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

const imageListFor = (listing) =>
  listing.imageUrls?.length
    ? listing.imageUrls
    : listing.imageUrl
      ? [listing.imageUrl]
      : [];

export const validateMarketplaceListingUpdate = (body) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Provide a valid listing update" };
  }

  const keys = Object.keys(body);
  if (!keys.length || keys.some((key) => !EDITABLE_FIELDS.has(key))) {
    return { error: "The update contains unsupported listing fields" };
  }

  const updates = {};
  if (Object.hasOwn(body, "title")) {
    if (
      typeof body.title !== "string" ||
      body.title.trim().length < 3 ||
      body.title.trim().length > 100
    ) {
      return { error: "Title must be between 3 and 100 characters" };
    }
    updates.title = body.title.trim();
  }
  if (Object.hasOwn(body, "description")) {
    if (typeof body.description !== "string" || body.description.length > 2000) {
      return { error: "Description must be 2000 characters or fewer" };
    }
    updates.description = body.description.trim();
  }
  if (Object.hasOwn(body, "category")) {
    if (
      typeof body.category !== "string" ||
      !body.category.trim() ||
      body.category.trim().length > 80
    ) {
      return {
        error:
          typeof body.category === "string" && body.category.trim().length > 80
            ? "Category must be 80 characters or fewer"
            : "Category is required",
      };
    }
    updates.category = body.category.trim();
  }
  if (Object.hasOwn(body, "price")) {
    if (
      body.price !== null &&
      (typeof body.price !== "number" ||
        !Number.isFinite(body.price) ||
        body.price < 0)
    ) {
      return { error: "Price must be a non-negative number or null" };
    }
    updates.price = body.price;
  }
  if (Object.hasOwn(body, "currency")) {
    if (typeof body.currency !== "string" || !/^[a-z]{3}$/i.test(body.currency.trim())) {
      return { error: "Currency must be a 3-letter code" };
    }
    updates.currency = body.currency.trim().toUpperCase();
  }
  if (Object.hasOwn(body, "location")) {
    if (typeof body.location !== "string" || body.location.length > 120) {
      return { error: "Location must be 120 characters or fewer" };
    }
    updates.location = body.location.trim();
  }
  if (Object.hasOwn(body, "contactMethod")) {
    if (!["message", "external_link"].includes(body.contactMethod)) {
      return { error: "Choose a valid contact method" };
    }
    updates.contactMethod = body.contactMethod;
  }
  if (Object.hasOwn(body, "contactUrl")) {
    if (typeof body.contactUrl !== "string" || body.contactUrl.length > 2048) {
      return { error: "Contact link must be 2048 characters or fewer" };
    }
    updates.contactUrl = body.contactUrl.trim();
  }
  if (Object.hasOwn(body, "contactMethod") && body.contactMethod === "message") {
    updates.contactUrl = "";
  }
  if (Object.hasOwn(body, "imageUrls")) {
    if (
      !Array.isArray(body.imageUrls) ||
      body.imageUrls.length > MAX_MARKETPLACE_IMAGES ||
      body.imageUrls.some(
        (url) => typeof url !== "string" || url.length > 2048,
      )
    ) {
      return {
        error: `Add up to ${MAX_MARKETPLACE_IMAGES} valid listing photos`,
      };
    }
    updates.imageUrls = [
      ...new Set(body.imageUrls.map((url) => url.trim()).filter(Boolean)),
    ];
  }
  if (Object.hasOwn(body, "videoUrl")) {
    if (typeof body.videoUrl !== "string" || body.videoUrl.length > 2048) {
      return { error: "Marketplace video URL is invalid" };
    }
    updates.videoUrl = body.videoUrl.trim();
  }

  return { updates };
};

export const resolveMarketplaceListingMedia = async ({
  updates,
  listing,
  userId,
  verifyMediaUrl,
}) => {
  const resolved = { ...updates };
  const existingImages = new Set(imageListFor(listing));

  if (Object.hasOwn(updates, "imageUrls")) {
    resolved.imageUrls = await Promise.all(
      updates.imageUrls.map(async (url) => {
        if (existingImages.has(url)) return url;
        const verified = await verifyMediaUrl(url, userId, "image");
        return verified.url;
      }),
    );
    // Avoid resurrecting an old imageUrl when an owner intentionally removes
    // every image from a legacy listing.
    resolved.imageUrl = "";
  }

  if (Object.hasOwn(updates, "videoUrl") && updates.videoUrl) {
    if (updates.videoUrl !== listing.videoUrl) {
      const verified = await verifyMediaUrl(updates.videoUrl, userId, "video");
      resolved.videoUrl = verified.url;
    }
  }

  return resolved;
};

export const isValidMarketplaceContactUrl = isValidHttpUrl;
