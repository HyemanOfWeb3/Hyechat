import { getMarketplaceListingImages } from "../components/marketplace/marketplaceMedia.js";

export const canEditMarketplaceEvent = (listing, userId) => {
  const sellerId = listing?.seller?._id || listing?.seller;
  return Boolean(
    listing?.type === "event" &&
      sellerId &&
      userId &&
      String(sellerId) === String(userId),
  );
};

export const createMarketplaceEditForm = (listing) => ({
  title: listing?.title || "",
  description: listing?.description || "",
  category: listing?.category || "",
  price:
    listing?.price === null || listing?.price === undefined
      ? ""
      : String(listing.price),
  currency: listing?.currency || "USD",
  location: listing?.location || "",
  contactMethod: listing?.contactMethod || "message",
  contactUrl: listing?.contactUrl || "",
});

export const buildMarketplaceEditPayload = (form, media) => ({
  title: form.title,
  description: form.description,
  category: form.category,
  price: form.price === "" ? null : Number(form.price),
  currency: form.currency,
  location: form.location,
  contactMethod: form.contactMethod,
  contactUrl: form.contactMethod === "external_link" ? form.contactUrl : "",
  imageUrls: media.images.map((image) => image.url),
  videoUrl: media.video?.url || "",
});

const replaceListing = (listing, listingId, updatedListing) =>
  listing?._id === listingId ? { ...listing, ...updatedListing } : listing;

export const replaceMarketplaceListingInCache = (
  data,
  listingId,
  updatedListing,
) => {
  if (!data || typeof data !== "object") return data;

  if (Array.isArray(data.pages)) {
    return {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        listings: page.listings?.map((listing) =>
          replaceListing(listing, listingId, updatedListing),
        ),
        reports: page.reports?.map((report) => ({
          ...report,
          listing: replaceListing(report.listing, listingId, updatedListing),
        })),
      })),
    };
  }

  if (Array.isArray(data.listings)) {
    return {
      ...data,
      listings: data.listings.map((listing) =>
        replaceListing(listing, listingId, updatedListing),
      ),
    };
  }

  if (data.listing?._id === listingId) {
    return { ...data, listing: { ...data.listing, ...updatedListing } };
  }

  if (Array.isArray(data.reports)) {
    return {
      ...data,
      reports: data.reports.map((report) => ({
        ...report,
        listing: replaceListing(report.listing, listingId, updatedListing),
      })),
    };
  }

  return data;
};

export const getMarketplaceEditMedia = (listing) => ({
  imageUrls: getMarketplaceListingImages(listing),
  videoUrl: listing?.videoUrl || "",
});
