import MarketplaceListingReport from "../models/MarketplaceListingReport.js";

export const getReportedMarketplaceListingIds = async (
  reporterId,
  listings,
  { reportModel = MarketplaceListingReport } = {},
) => {
  const listingIds = listings
    .map((listing) => listing?._id)
    .filter(Boolean);
  if (!reporterId || listingIds.length === 0) return new Set();

  const reports = await reportModel
    .find({ reporter: reporterId, listing: { $in: listingIds } })
    .select("listing")
    .lean();
  return new Set(reports.map((report) => report.listing.toString()));
};
