import { useEffect, useMemo, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  BadgeCheck,
  Bookmark,
  CalendarDays,
  ExternalLink,
  Flag,
  GraduationCap,
  MapPin,
  MessageCircle,
  PackageOpen,
  Plus,
  Search,
  Share2,
  ShoppingBag,
  Sparkles,
  Store,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import useAuthUser from "../../hooks/useAuthUser.js";
import UserProfileLink from "../UserProfileLink.jsx";
import UserAvatar from "../UserAvatar.jsx";
import MarketplaceMediaUploader from "./MarketplaceMediaUploader.jsx";
import {
  getMarketplaceCategoryOptions,
  resolveMarketplaceCategory,
  selectMarketplaceListingType,
} from "./marketplaceCategories.js";
import {
  createMarketplaceListing,
  getMarketplaceCategories,
  getMarketplaceListing,
  getMarketplaceListings,
  getMarketplaceModerationReports,
  getMyMarketplaceListings,
  getSavedMarketplaceListings,
  reportMarketplaceListing,
  resolveMarketplaceModerationReport,
  saveMarketplaceListing,
  unsaveMarketplaceListing,
  updateMarketplaceListingStatus,
} from "../../lib/api.js";
import { useMarketplaceMedia } from "../../hooks/useMarketplaceMedia.js";
import { getMarketplaceListingImages } from "./marketplaceMedia.js";

const listingTypes = [
  { value: "physical_product", label: "Physical Product", icon: ShoppingBag },
  { value: "digital_product", label: "Digital Product", icon: PackageOpen },
  { value: "service", label: "Service", icon: UsersRound },
  { value: "creator_offering", label: "Creator Offering", icon: Sparkles },
  { value: "business", label: "Business", icon: Store },
  { value: "course", label: "Course", icon: GraduationCap },
  { value: "event", label: "Event", icon: CalendarDays },
];

const createEmptyListing = () => ({
  title: "",
  description: "",
  type: "physical_product",
  category: "",
  customCategory: "",
  price: "",
  currency: "USD",
  condition: "not_applicable",
  location: "",
  contactMethod: "message",
  contactUrl: "",
});

const conditions = [
  ["not_applicable", "Not applicable"],
  ["new", "New"],
  ["like_new", "Like new"],
  ["good", "Good"],
  ["fair", "Fair"],
];

const reportReasons = [
  ["spam", "Spam"],
  ["scam", "Scam or misleading"],
  ["inappropriate", "Inappropriate content"],
  ["prohibited", "Prohibited item or service"],
  ["other", "Other"],
];

const statusLabels = {
  active: "Active",
  hidden: "Hidden",
  reported: "Under review",
  removed: "Removed",
};

const typeLabel = (type) =>
  listingTypes.find((item) => item.value === type)?.label || "Offering";

const errorMessage = (error, fallback) =>
  error?.response?.data?.message || fallback;

const listingPages = (data, field = "listings") =>
  data?.pages.flatMap((page) => page[field] || []) || [];

const getNextPage = (lastPage) =>
  lastPage.pagination?.hasMore ? lastPage.pagination.page + 1 : undefined;

const priceLabel = (listing) =>
  listing.price === null || listing.price === undefined
    ? "Contact for price"
    : `${listing.currency || "USD"} ${Number(listing.price).toFixed(2)}`;

const MarketplaceCard = ({
  listing,
  onOpen,
  onSave,
  saving,
  ownerMode = false,
}) => {
  const images = getMarketplaceListingImages(listing);
  const image = images[0];
  const [failedImage, setFailedImage] = useState("");
  const TypeIcon =
    listingTypes.find((item) => item.value === listing.type)?.icon ||
    PackageOpen;

  return (
    <article className="card overflow-hidden border border-base-300 bg-base-200 shadow-sm transition-shadow hover:shadow-md">
      <button
        type="button"
        className="relative block h-44 w-full overflow-hidden bg-base-300/60 text-left"
        onClick={() => onOpen(listing)}
        aria-label={`View listing: ${listing.title}`}
      >
        {image && image !== failedImage ? (
          <img
            src={image}
            alt={listing.title}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            referrerPolicy="no-referrer"
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
            onError={() => setFailedImage(image)}
          />
        ) : (
          <span className="flex h-full items-center justify-center">
            <TypeIcon className="size-10 opacity-35" />
          </span>
        )}
        {listing.videoUrl && (
          <span className="badge badge-neutral absolute left-2 top-2">
            Video
          </span>
        )}
        {images.length > 1 && (
          <span className="badge badge-neutral absolute bottom-2 right-2">
            +{images.length - 1} photos
          </span>
        )}
      </button>
      <div className="card-body gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="badge badge-secondary badge-outline badge-sm">
              {typeLabel(listing.type)}
            </span>
            {listing.category && (
              <span className="badge badge-ghost badge-sm">
                {listing.category}
              </span>
            )}
          </div>
          <span className="shrink-0 text-sm font-bold">
            {priceLabel(listing)}
          </span>
        </div>
        <button
          type="button"
          className="line-clamp-2 text-left text-base font-bold hover:text-primary"
          onClick={() => onOpen(listing)}
        >
          {listing.title}
        </button>
        <p className="line-clamp-2 min-h-10 text-sm opacity-70">
          {listing.description || "Open this listing to learn more."}
        </p>
        <div className="flex min-w-0 items-center gap-2 text-xs opacity-70">
          <UserAvatar
            src={listing.seller?.profilePic}
            name={listing.seller?.fullName}
            userId={listing.seller?._id}
            alt=""
            className="size-7 text-xs"
          />
          <UserProfileLink
            userId={listing.seller?._id}
            className="truncate hover:text-primary"
          >
            {listing.seller?.fullName || "HyeChat seller"}
          </UserProfileLink>
          {listing.seller?.emailVerified && (
            <BadgeCheck
              className="size-4 shrink-0 text-info"
              aria-label="Email verified"
            />
          )}
          {listing.location && (
            <span className="ml-auto flex shrink-0 items-center gap-1">
              <MapPin className="size-3" /> {listing.location}
            </span>
          )}
        </div>
        <div className="mt-auto flex gap-2 pt-1">
          <button
            type="button"
            className="btn btn-outline btn-sm flex-1"
            onClick={() => onOpen(listing)}
          >
            View listing
          </button>
          {!ownerMode && (
            <button
              type="button"
              className={`btn btn-square btn-sm ${listing.isSaved ? "btn-primary" : "btn-ghost"}`}
              onClick={() => onSave(listing)}
              disabled={saving}
              aria-label={
                listing.isSaved ? "Remove saved listing" : "Save listing"
              }
              aria-pressed={Boolean(listing.isSaved)}
            >
              <Bookmark
                className="size-4"
                fill={listing.isSaved ? "currentColor" : "none"}
              />
            </button>
          )}
        </div>
        {ownerMode && (
          <div className="flex items-center justify-between border-t border-base-300 pt-2">
            <span
              className={`badge badge-sm ${listing.status === "active" ? "badge-success" : listing.status === "reported" ? "badge-warning" : "badge-ghost"}`}
            >
              {statusLabels[listing.status] || listing.status}
            </span>
          </div>
        )}
      </div>
    </article>
  );
};

export const MarketplaceListingGallery = ({ listing }) => {
  const images = getMarketplaceListingImages(listing);
  const [failedImages, setFailedImages] = useState(() => new Set());
  const [failedVideo, setFailedVideo] = useState("");

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {images.map((image, index) => (
        <div
          key={`${image}-${index}`}
          className={`relative aspect-[4/3] max-h-[420px] overflow-hidden rounded-xl bg-base-200 ${index === 0 ? "sm:col-span-2" : ""}`}
        >
          {failedImages.has(image) ? (
            <div className="flex size-full flex-col items-center justify-center gap-2 text-sm opacity-60">
              <PackageOpen className="size-10" aria-hidden="true" />
              <span>Image unavailable</span>
            </div>
          ) : (
            <img
              src={image}
              alt={`${listing.title} photo ${index + 1}`}
              className="size-full object-cover"
              loading={index === 0 ? "eager" : "lazy"}
              decoding="async"
              fetchPriority={index === 0 ? "high" : "low"}
              onError={() =>
                setFailedImages((current) => new Set([...current, image]))
              }
            />
          )}
        </div>
      ))}
      {images.length === 0 && (
        <div className="flex aspect-[4/3] max-h-[420px] items-center justify-center rounded-xl bg-base-200 sm:col-span-2">
          <PackageOpen className="size-12 opacity-30" aria-hidden="true" />
          <span className="sr-only">No listing photos</span>
        </div>
      )}
      {listing.videoUrl && (
        <div className="aspect-video overflow-hidden rounded-xl bg-black sm:col-span-2">
          {failedVideo === listing.videoUrl ? (
            <div className="flex size-full items-center justify-center bg-base-200 text-sm opacity-60" role="status">
              Video unavailable
            </div>
          ) : (
            <video
              src={listing.videoUrl}
              controls
              playsInline
              preload="metadata"
              className="size-full object-contain"
              aria-label={`${listing.title} listing video`}
              onError={() => setFailedVideo(listing.videoUrl)}
            />
          )}
        </div>
      )}
    </div>
  );
};

const MarketplacePanel = ({ searchQuery = "", isMarketplaceScope = true }) => {
  const { authUser } = useAuthUser();
  const media = useMarketplaceMedia(authUser?._id);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState("discover");
  const [type, setType] = useState("");
  const [category, setCategory] = useState("");
  const [minimumPrice, setMinimumPrice] = useState("");
  const [maximumPrice, setMaximumPrice] = useState("");
  const [location, setLocation] = useState("");
  const [sellerSearch, setSellerSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedListingState, setSelectedListing] = useState(null);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState("inappropriate");
  const [reportDetails, setReportDetails] = useState("");
  const [newListing, setNewListing] = useState(createEmptyListing);
  const marketplaceSentinel = useRef(null);
  const communitySearch = searchQuery.trim();
  const hasFilterScope = isMarketplaceScope;
  const activeViewMode = isMarketplaceScope ? viewMode : "discover";
  const listingId = searchParams.get("listing") || "";
  const isModerator = Boolean(authUser?.isMarketplaceModerator);

  const marketplaceFilters = useMemo(
    () => ({
      query: communitySearch,
      type: hasFilterScope ? type : "",
      category: hasFilterScope ? category : "",
      minPrice: hasFilterScope ? minimumPrice : "",
      maxPrice: hasFilterScope ? maximumPrice : "",
      location: hasFilterScope ? location : "",
      seller: hasFilterScope ? sellerSearch : "",
    }),
    [
      communitySearch,
      hasFilterScope,
      type,
      category,
      minimumPrice,
      maximumPrice,
      location,
      sellerSearch,
    ],
  );

  const discoverQuery = useInfiniteQuery({
    queryKey: ["marketplace", "discover", marketplaceFilters],
    queryFn: ({ pageParam }) =>
      getMarketplaceListings({ ...marketplaceFilters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: getNextPage,
    enabled: activeViewMode === "discover",
  });
  const mineQuery = useInfiniteQuery({
    queryKey: ["marketplace", "mine"],
    queryFn: ({ pageParam }) => getMyMarketplaceListings({ page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: getNextPage,
    enabled: activeViewMode === "mine",
  });
  const savedQuery = useInfiniteQuery({
    queryKey: ["marketplace", "saved"],
    queryFn: ({ pageParam }) =>
      getSavedMarketplaceListings({ page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: getNextPage,
    enabled: activeViewMode === "saved",
  });
  const reportsQuery = useQuery({
    queryKey: ["marketplace", "moderationReports"],
    queryFn: getMarketplaceModerationReports,
    enabled: activeViewMode === "reports" && isModerator,
  });
  const categoriesQuery = useQuery({
    queryKey: ["marketplace", "categories"],
    queryFn: getMarketplaceCategories,
  });
  const listingDetailQuery = useQuery({
    queryKey: ["marketplace", "listing", listingId],
    queryFn: () => getMarketplaceListing(listingId),
    enabled: Boolean(listingId),
  });
  const selectedListing =
    selectedListingState || listingDetailQuery.data?.listing || null;
  const sellerListingsQuery = useInfiniteQuery({
    queryKey: ["marketplace", "seller", selectedListing?.seller?._id],
    queryFn: ({ pageParam }) =>
      getMarketplaceListings({
        seller: selectedListing.seller._id,
        page: pageParam,
      }),
    initialPageParam: 1,
    getNextPageParam: getNextPage,
    enabled: Boolean(selectedListing?.seller?._id),
  });
  const hasMoreDiscoverListings = discoverQuery.hasNextPage;
  const isLoadingMoreDiscoverListings = discoverQuery.isFetchingNextPage;
  const fetchNextDiscoverPage = discoverQuery.fetchNextPage;

  useEffect(() => {
    if (activeViewMode !== "discover" || !hasMoreDiscoverListings)
      return undefined;
    const node = marketplaceSentinel.current;
    if (!node || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isLoadingMoreDiscoverListings) {
          fetchNextDiscoverPage();
        }
      },
      { rootMargin: "320px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [
    activeViewMode,
    hasMoreDiscoverListings,
    isLoadingMoreDiscoverListings,
    fetchNextDiscoverPage,
  ]);

  const refreshMarketplace = () => {
    queryClient.invalidateQueries({ queryKey: ["marketplace"] });
  };

  const closeListing = () => {
    setSelectedListing(null);
    setShowReportForm(false);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("listing");
      return next;
    });
  };

  const openListing = (listing) => {
    setSelectedListing(listing);
    setShowReportForm(false);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("listing", listing._id);
      return next;
    });
  };

  const createMutation = useMutation({
    mutationFn: createMarketplaceListing,
    onSuccess: () => {
      setNewListing(createEmptyListing());
      setShowCreateForm(false);
      setViewMode("mine");
      void media.releasePreviews();
      refreshMarketplace();
      toast.success("Listing published");
    },
    onError: async (error) => {
      const cleaned = await media.cleanupUnattached();
      toast.error(errorMessage(error, "Unable to create listing")),
      !cleaned &&
        toast.error(
          "Unused uploads could not all be removed. They remain unattached to a listing.",
        );
    },
  });
  const saveMutation = useMutation({
    mutationFn: ({ listing, wasSaved }) =>
      wasSaved
        ? unsaveMarketplaceListing(listing._id)
        : saveMarketplaceListing(listing._id),
    onSuccess: (_result, { listing, wasSaved }) => {
      setSelectedListing((current) =>
        current?._id === listing._id
          ? { ...current, isSaved: !wasSaved }
          : current,
      );
      refreshMarketplace();
      toast.success(wasSaved ? "Listing removed from saved" : "Listing saved");
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Unable to save listing")),
  });
  const reportMutation = useMutation({
    mutationFn: ({ id, report }) => reportMarketplaceListing(id, report),
    onSuccess: () => {
      refreshMarketplace();
      closeListing();
      setReportDetails("");
      toast.success("Thanks. This listing is hidden while it is reviewed.");
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Unable to submit report")),
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updateMarketplaceListingStatus(id, status),
    onSuccess: () => {
      refreshMarketplace();
      setSelectedListing(null);
      toast.success("Listing status updated");
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Unable to update listing")),
  });
  const moderationMutation = useMutation({
    mutationFn: ({ reportId, decision }) =>
      resolveMarketplaceModerationReport(reportId, decision),
    onSuccess: () => {
      refreshMarketplace();
      toast.success("Report reviewed");
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Unable to review report")),
  });

  const publicListings = listingPages(discoverQuery.data);
  const myListings = listingPages(mineQuery.data);
  const savedListings = listingPages(savedQuery.data);
  const categories = categoriesQuery.data?.categories || [];
  const sellerListings = listingPages(sellerListingsQuery.data).filter(
    (listing) => listing._id !== selectedListing?._id,
  );
  const reports = reportsQuery.data?.reports || [];
  const activeQuery =
    activeViewMode === "discover"
      ? discoverQuery
      : activeViewMode === "mine"
        ? mineQuery
        : savedQuery;
  const visibleListings =
    activeViewMode === "discover"
      ? publicListings
      : activeViewMode === "mine"
        ? myListings
        : savedListings;

  const handleCreateListing = (event) => {
    event.preventDefault();
    if (createMutation.isPending) return;
    const { category, error } = resolveMarketplaceCategory(
      newListing.category,
      newListing.customCategory,
    );
    if (error) {
      toast.error(error);
      return;
    }

    if (!media.isReady) {
      toast.error(
        media.hasPendingUpload
          ? "Wait for selected media uploads to finish."
          : "Resolve or remove media errors before publishing.",
      );
      return;
    }

    createMutation.mutate({
      title: newListing.title,
      description: newListing.description,
      type: newListing.type,
      category,
      price: newListing.price === "" ? null : Number(newListing.price),
      currency: newListing.currency,
      condition:
        newListing.type === "physical_product"
          ? newListing.condition
          : "not_applicable",
      imageUrls: media.images.map((image) => image.url),
      videoUrl: media.video?.url || "",
      location: newListing.location,
      contactMethod: newListing.contactMethod,
      contactUrl:
        newListing.contactMethod === "external_link"
          ? newListing.contactUrl
          : "",
    });
  };

  const shareListing = async (listing) => {
    const url = new URL("/explore", window.location.origin);
    url.searchParams.set("listing", listing._id);
    try {
      if (navigator.share) {
        await navigator.share({ title: listing.title, url: url.toString() });
      } else {
        await navigator.clipboard.writeText(url.toString());
        toast.success("Listing link copied");
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        toast.error("Could not share this listing");
      }
    }
  };

  const cancelCreateListing = () => {
    if (createMutation.isPending) return;
    setShowCreateForm(false);
    setNewListing(createEmptyListing());
    void media.resetMedia();
  };

  const renderEmpty = (title, description) => (
    <div className="rounded-2xl border border-dashed border-base-300 p-9 text-center sm:p-12">
      <PackageOpen className="mx-auto mb-3 size-9 opacity-40" />
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm opacity-60">{description}</p>
    </div>
  );

  const renderLoadMore = (query, label) =>
    query.hasNextPage && (
      <div className="mt-5 flex justify-center">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
        >
          {query.isFetchingNextPage ? "Loading…" : label}
        </button>
      </div>
    );

  const filterControls = isMarketplaceScope && (
    <div className="mb-5 space-y-3 rounded-2xl border border-base-300 bg-base-200 p-3 sm:p-4">
      <div
        className="flex flex-wrap gap-2 overflow-x-auto pb-1"
        aria-label="Offering type"
      >
        <button
          type="button"
          className={`btn btn-xs shrink-0 ${type === "" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setType("")}
        >
          All types
        </button>
        {listingTypes.map((item) => (
          <button
            type="button"
            key={item.value}
            className={`btn btn-xs shrink-0 ${type === item.value ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setType(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        aria-expanded={showFilters}
        onClick={() => setShowFilters((show) => !show)}
      >
        <Search className="size-4" />{" "}
        {showFilters ? "Hide filters" : "Filter listings"}
      </button>
      {showFilters && (
        <div className="grid gap-3 border-t border-base-300 pt-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="form-control">
            <span className="label-text mb-1 text-xs font-semibold">
              Flexible category
            </span>
            <select
              className="select select-bordered select-sm"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="form-control">
            <span className="label-text mb-1 text-xs font-semibold">
              Seller name
            </span>
            <input
              className="input input-bordered input-sm"
              value={sellerSearch}
              onChange={(event) => setSellerSearch(event.target.value)}
              placeholder="Search seller"
            />
          </label>
          <label className="form-control">
            <span className="label-text mb-1 text-xs font-semibold">
              Location (optional)
            </span>
            <input
              className="input input-bordered input-sm"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="City or area"
            />
          </label>
          <label className="form-control">
            <span className="label-text mb-1 text-xs font-semibold">
              Minimum price
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              className="input input-bordered input-sm"
              value={minimumPrice}
              onChange={(event) => setMinimumPrice(event.target.value)}
              placeholder="Any"
            />
          </label>
          <label className="form-control">
            <span className="label-text mb-1 text-xs font-semibold">
              Maximum price
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              className="input input-bordered input-sm"
              value={maximumPrice}
              onChange={(event) => setMaximumPrice(event.target.value)}
              placeholder="Any"
            />
          </label>
          <button
            type="button"
            className="btn btn-ghost btn-sm self-end"
            onClick={() => {
              setType("");
              setCategory("");
              setMinimumPrice("");
              setMaximumPrice("");
              setLocation("");
              setSellerSearch("");
            }}
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );

  return (
    <section
      aria-labelledby="explore-marketplace-heading"
      className="space-y-4"
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="explore-marketplace-heading" className="text-xl font-bold">
            HyeMarket
          </h2>
          <p className="mt-1 text-sm opacity-60">
            Discover offerings and connect with sellers through HyeChat.
          </p>
        </div>
        {isMarketplaceScope && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setViewMode("mine");
                if (showCreateForm) cancelCreateListing();
              }}
              disabled={createMutation.isPending}
            >
              My listings
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setViewMode("mine");
                if (showCreateForm) cancelCreateListing();
                else setShowCreateForm(true);
              }}
              disabled={createMutation.isPending}
            >
              <Plus className="size-4" /> Create listing
            </button>
          </div>
        )}
      </div>

      {isMarketplaceScope && (
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Marketplace views"
        >
          {[
            ["discover", "Discover"],
            ["saved", "Saved"],
            ["mine", "My listings"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={viewMode === id}
              className={`btn btn-sm shrink-0 rounded-full ${viewMode === id ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setViewMode(id)}
            >
              {label}
            </button>
          ))}
          {isModerator && (
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "reports"}
              className={`btn btn-sm shrink-0 rounded-full ${viewMode === "reports" ? "btn-warning" : "btn-ghost"}`}
              onClick={() => setViewMode("reports")}
            >
              Review reports
            </button>
          )}
        </div>
      )}

      {showCreateForm && isMarketplaceScope && (
        <form
          className="rounded-2xl border border-base-300 bg-base-200 p-4 shadow-sm sm:p-6"
          onSubmit={handleCreateListing}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold">Create a listing</h3>
              <p className="text-xs opacity-60">
                No payment, phone, or address details are needed. Buyers can
                message you on HyeChat.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-square btn-sm"
              aria-label="Close listing form"
              onClick={cancelCreateListing}
              disabled={createMutation.isPending}
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="form-control sm:col-span-2">
              <span className="label-text mb-1 font-semibold">Title</span>
              <input
                className="input input-bordered"
                value={newListing.title}
                onChange={(event) =>
                  setNewListing({ ...newListing, title: event.target.value })
                }
                minLength={3}
                maxLength={100}
                required
              />
            </label>
            <label className="form-control" htmlFor="marketplace-listing-type">
              <span className="label-text mb-1 font-semibold">
                Listing type
              </span>
              <select
                id="marketplace-listing-type"
                className="select select-bordered"
                value={newListing.type}
                onChange={(event) =>
                  setNewListing((current) =>
                    selectMarketplaceListingType(current, event.target.value),
                  )
                }
                required
              >
                {listingTypes.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-control" htmlFor="marketplace-listing-category">
              <span className="label-text mb-1 font-semibold">Category</span>
              <select
                id="marketplace-listing-category"
                className="select select-bordered"
                value={newListing.category}
                onChange={(event) =>
                  setNewListing((current) => ({
                    ...current,
                    category: event.target.value,
                    customCategory: "",
                  }))
                }
                aria-describedby="marketplace-category-help"
                required
              >
                <option value="">Select a category</option>
                {getMarketplaceCategoryOptions(newListing.type).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <span id="marketplace-category-help" className="mt-1 text-xs opacity-60">
                Suggestions are flexible. Choose Other to enter a custom
                category.
              </span>
            </label>
            {newListing.category === "Other" && (
              <label
                className="form-control sm:col-span-2"
                htmlFor="marketplace-custom-category"
              >
                <span className="label-text mb-1 font-semibold">
                  Custom category
                </span>
                <input
                  id="marketplace-custom-category"
                  className="input input-bordered"
                  value={newListing.customCategory}
                  onChange={(event) =>
                    setNewListing((current) => ({
                      ...current,
                      customCategory: event.target.value,
                    }))
                  }
                  maxLength={80}
                  placeholder="Enter your category"
                  aria-describedby="marketplace-custom-category-help"
                  required
                />
                <span
                  id="marketplace-custom-category-help"
                  className="mt-1 text-xs opacity-60"
                >
                  Use up to 80 characters.
                </span>
              </label>
            )}
            <label className="form-control sm:col-span-2">
              <span className="label-text mb-1 font-semibold">Description</span>
              <textarea
                className="textarea textarea-bordered min-h-24"
                value={newListing.description}
                onChange={(event) =>
                  setNewListing({
                    ...newListing,
                    description: event.target.value,
                  })
                }
                maxLength={2000}
              />
            </label>
            {newListing.type === "physical_product" && (
              <label className="form-control">
                <span className="label-text mb-1 font-semibold">Condition</span>
                <select
                  className="select select-bordered"
                  value={newListing.condition}
                  onChange={(event) =>
                    setNewListing({
                      ...newListing,
                      condition: event.target.value,
                    })
                  }
                >
                  {conditions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="grid grid-cols-[1fr_6rem] gap-2">
              <label className="form-control">
                <span className="label-text mb-1 font-semibold">
                  Price (optional)
                </span>
                <input
                  type="number"
                  className="input input-bordered"
                  value={newListing.price}
                  onChange={(event) =>
                    setNewListing({ ...newListing, price: event.target.value })
                  }
                  min="0"
                  step="0.01"
                />
              </label>
              <label className="form-control">
                <span className="label-text mb-1 font-semibold">Currency</span>
                <input
                  className="input input-bordered uppercase"
                  value={newListing.currency}
                  onChange={(event) =>
                    setNewListing({
                      ...newListing,
                      currency: event.target.value.toUpperCase(),
                    })
                  }
                  maxLength={3}
                  required
                />
              </label>
            </div>
            <label className="form-control">
              <span className="label-text mb-1 font-semibold">
                Location or service area (optional)
              </span>
              <input
                className="input input-bordered"
                value={newListing.location}
                onChange={(event) =>
                  setNewListing({ ...newListing, location: event.target.value })
                }
                maxLength={120}
                placeholder="City or general area"
              />
            </label>
            <label className="form-control">
              <span className="label-text mb-1 font-semibold">
                Contact action
              </span>
              <select
                className="select select-bordered"
                value={newListing.contactMethod}
                onChange={(event) =>
                  setNewListing({
                    ...newListing,
                    contactMethod: event.target.value,
                  })
                }
              >
                <option value="message">Message on HyeChat</option>
                <option value="external_link">
                  External website or booking link
                </option>
              </select>
            </label>
            {newListing.contactMethod === "external_link" && (
              <label className="form-control sm:col-span-2">
                <span className="label-text mb-1 font-semibold">
                  External action URL
                </span>
                <input
                  type="url"
                  className="input input-bordered"
                  value={newListing.contactUrl}
                  onChange={(event) =>
                    setNewListing({
                      ...newListing,
                      contactUrl: event.target.value,
                    })
                  }
                  maxLength={2048}
                  placeholder="https://..."
                  required
                />
              </label>
            )}
            <div className="min-w-0 sm:col-span-2">
              <MarketplaceMediaUploader
                images={media.images}
                video={media.video}
                allowVideo
                disabled={createMutation.isPending}
                onAddImages={media.addImages}
                onReplaceImage={media.replaceImage}
                onRemoveImage={media.removeImage}
                onMoveImage={media.moveImage}
                onAddVideo={media.addVideo}
                onRetryVideo={media.addVideo}
                onRemoveVideo={media.removeVideo}
                errors={media.errors}
                onDismissError={media.clearError}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={cancelCreateListing}
              disabled={createMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={
                createMutation.isPending ||
                media.hasPendingUpload ||
                media.hasUploadError
              }
            >
              {createMutation.isPending
                ? "Publishing…"
                : media.hasPendingUpload
                  ? "Uploading media…"
                  : media.hasUploadError
                    ? "Resolve media issues"
                    : "Publish listing"}
            </button>
          </div>
        </form>
      )}

      {activeViewMode === "discover" && filterControls}

      {activeViewMode === "reports" && isModerator ? (
        reportsQuery.isLoading ? (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : reports.length === 0 ? (
          renderEmpty(
            "No open reports",
            "Reported HyeMarket listings will appear here for review.",
          )
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <article
                key={report._id}
                className="rounded-2xl border border-base-300 bg-base-200 p-4"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase text-warning">
                      {report.reason} · reported by{" "}
                      {report.reporter?.fullName || "member"}
                    </p>
                    <h3 className="mt-1 font-bold">
                      {report.listing?.title || "Listing unavailable"}
                    </h3>
                    {report.details && (
                      <p className="mt-1 text-sm opacity-70">
                        {report.details}
                      </p>
                    )}
                    <p className="mt-2 text-xs opacity-60">
                      Seller:{" "}
                      {report.listing?.seller?.fullName || "Unavailable"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() =>
                        moderationMutation.mutate({
                          reportId: report._id,
                          decision: "active",
                        })
                      }
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        moderationMutation.mutate({
                          reportId: report._id,
                          decision: "hidden",
                        })
                      }
                    >
                      Keep hidden
                    </button>
                    <button
                      type="button"
                      className="btn btn-error btn-sm"
                      onClick={() =>
                        moderationMutation.mutate({
                          reportId: report._id,
                          decision: "removed",
                        })
                      }
                    >
                      Remove listing
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )
      ) : activeViewMode === "mine" ||
        activeViewMode === "saved" ||
        activeViewMode === "discover" ? (
        activeQuery.isLoading ? (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : activeQuery.isError ? (
          <div className="alert alert-error">
            {errorMessage(activeQuery.error, "Unable to load HyeMarket")}
          </div>
        ) : visibleListings.length === 0 ? (
          renderEmpty(
            activeViewMode === "mine"
              ? "No listings yet"
              : activeViewMode === "saved"
                ? "No saved listings"
                : "No listings found",
            activeViewMode === "mine"
              ? "Create a listing to introduce your offering to HyeChat."
              : activeViewMode === "saved"
                ? "Save listings to find them here later."
                : "Try different filters or broaden your search.",
          )
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleListings.map((listing) => (
                <div key={listing._id} className="space-y-2">
                  <MarketplaceCard
                    listing={listing}
                    onOpen={openListing}
                    onSave={(item) =>
                      saveMutation.mutate({
                        listing: item,
                        wasSaved: item.isSaved,
                      })
                    }
                    saving={saveMutation.isPending}
                    ownerMode={activeViewMode === "mine"}
                  />
                  {activeViewMode === "mine" &&
                    listing.status !== "removed" && (
                      <div className="flex justify-end gap-2">
                        {listing.status === "active" && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() =>
                              statusMutation.mutate({
                                id: listing._id,
                                status: "hidden",
                              })
                            }
                          >
                            Hide
                          </button>
                        )}
                        {listing.status === "hidden" && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() =>
                              statusMutation.mutate({
                                id: listing._id,
                                status: "active",
                              })
                            }
                          >
                            Show again
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-error btn-outline btn-xs"
                          onClick={() =>
                            statusMutation.mutate({
                              id: listing._id,
                              status: "removed",
                            })
                          }
                        >
                          <Trash2 className="size-3" /> Remove
                        </button>
                      </div>
                    )}
                </div>
              ))}
            </div>
            {renderLoadMore(activeQuery, "Load more listings")}
            {activeViewMode === "discover" && (
              <div
                ref={marketplaceSentinel}
                aria-hidden="true"
                className="h-2"
              />
            )}
          </>
        )
      ) : null}

      {listingId && listingDetailQuery.isLoading && !selectedListing && (
        <div className="modal modal-open z-50">
          <div className="modal-box flex justify-center">
            <span className="loading loading-spinner loading-lg" />
          </div>
        </div>
      )}
      {selectedListing && (
        <div
          className="modal modal-open z-50"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeListing();
          }}
        >
          <div
            className="modal-box max-h-[90dvh] w-11/12 max-w-5xl overflow-y-auto p-4 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="marketplace-listing-title"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <span className="badge badge-secondary badge-outline">
                  {typeLabel(selectedListing.type)}
                </span>
                {selectedListing.category && (
                  <span className="badge badge-ghost">
                    {selectedListing.category}
                  </span>
                )}
                {selectedListing.condition &&
                  selectedListing.condition !== "not_applicable" && (
                    <span className="badge badge-ghost">
                      {selectedListing.condition.replaceAll("_", " ")}
                    </span>
                  )}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-square btn-sm"
                onClick={closeListing}
                aria-label="Close listing"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <MarketplaceListingGallery
                  key={selectedListing._id}
                  listing={selectedListing}
                />
                <h2
                  id="marketplace-listing-title"
                  className="mt-5 text-2xl font-bold"
                >
                  {selectedListing.title}
                </h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed opacity-80">
                  {selectedListing.description || "No description provided."}
                </p>
                {selectedListing.location && (
                  <p className="mt-3 flex items-center gap-2 text-sm opacity-70">
                    <MapPin className="size-4" />
                    {selectedListing.location}
                  </p>
                )}
              </div>
              <aside className="space-y-4">
                <p className="text-2xl font-bold">
                  {priceLabel(selectedListing)}
                </p>
                <div className="rounded-2xl border border-base-300 bg-base-200 p-4">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wide opacity-60">
                    Seller profile
                  </p>
                  <div className="flex items-center gap-3">
                    <UserProfileLink
                      userId={selectedListing.seller?._id}
                      className="shrink-0 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      aria-label={`View ${selectedListing.seller?.fullName || "seller"}'s profile`}
                    >
                      <UserAvatar
                        src={selectedListing.seller?.profilePic}
                        name={selectedListing.seller?.fullName}
                        userId={selectedListing.seller?._id}
                        alt=""
                        className="size-14"
                      />
                    </UserProfileLink>
                    <div className="min-w-0">
                      <UserProfileLink
                        userId={selectedListing.seller?._id}
                        className="flex items-center gap-1 font-semibold hover:text-primary"
                      >
                        {selectedListing.seller?.fullName || "HyeChat seller"}
                        {selectedListing.seller?.emailVerified && (
                          <BadgeCheck
                            className="size-4 text-info"
                            aria-label="Email verified"
                          />
                        )}
                      </UserProfileLink>
                      {selectedListing.seller?.emailVerified && (
                        <p className="text-xs text-info">Email verified</p>
                      )}
                    </div>
                  </div>
                  {selectedListing.seller?.bio && (
                    <p className="mt-3 text-sm opacity-70">
                      {selectedListing.seller.bio}
                    </p>
                  )}
                  <p className="mt-3 text-xs opacity-50">
                    Seller ratings will be available later.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {selectedListing.seller?._id &&
                    selectedListing.seller._id !== authUser?._id && (
                      <Link
                        to={`/chat/${encodeURIComponent(selectedListing.seller._id)}`}
                        className="btn btn-primary col-span-2"
                      >
                        <MessageCircle className="size-4" /> Message seller
                      </Link>
                    )}
                  {selectedListing.contactMethod === "external_link" &&
                    selectedListing.contactUrl && (
                      <a
                        href={selectedListing.contactUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        referrerPolicy="no-referrer"
                        className="btn btn-outline col-span-2"
                      >
                        <ExternalLink className="size-4" /> Visit seller link
                      </a>
                    )}
                  {selectedListing.seller?._id !== authUser?._id && (
                    <button
                      type="button"
                      className={`btn btn-outline btn-sm`}
                      onClick={() =>
                        saveMutation.mutate({
                          listing: selectedListing,
                          wasSaved: selectedListing.isSaved,
                        })
                      }
                      disabled={saveMutation.isPending}
                    >
                      <Bookmark
                        className="size-4"
                        fill={selectedListing.isSaved ? "currentColor" : "none"}
                      />
                      {selectedListing.isSaved ? "Saved" : "Save"}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => shareListing(selectedListing)}
                  >
                    <Share2 className="size-4" /> Share
                  </button>
                  {selectedListing.seller?._id !== authUser?._id && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm col-span-2"
                      onClick={() => setShowReportForm((show) => !show)}
                    >
                      <Flag className="size-4" /> Report listing
                    </button>
                  )}
                </div>
                {showReportForm && (
                  <form
                    className="space-y-3 rounded-xl border border-warning/40 bg-warning/5 p-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      reportMutation.mutate({
                        id: selectedListing._id,
                        report: {
                          reason: reportReason,
                          details: reportDetails,
                        },
                      });
                    }}
                  >
                    <label className="form-control">
                      <span className="label-text mb-1 text-xs font-semibold">
                        Why are you reporting this?
                      </span>
                      <select
                        className="select select-bordered select-sm"
                        value={reportReason}
                        onChange={(event) =>
                          setReportReason(event.target.value)
                        }
                      >
                        {reportReasons.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="form-control">
                      <span className="label-text mb-1 text-xs font-semibold">
                        Optional details
                      </span>
                      <textarea
                        className="textarea textarea-bordered textarea-sm"
                        value={reportDetails}
                        onChange={(event) =>
                          setReportDetails(event.target.value)
                        }
                        maxLength={500}
                      />
                    </label>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={() => setShowReportForm(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn btn-warning btn-xs"
                        disabled={reportMutation.isPending}
                      >
                        {reportMutation.isPending
                          ? "Sending…"
                          : "Submit report"}
                      </button>
                    </div>
                  </form>
                )}
                {selectedListing.seller?._id && (
                  <div className="border-t border-base-300 pt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="font-semibold">More from this seller</h3>
                      {sellerListingsQuery.isLoading && (
                        <span className="loading loading-spinner loading-xs" />
                      )}
                    </div>
                    <div className="space-y-2">
                      {sellerListings.slice(0, 4).map((listing) => (
                        <button
                          type="button"
                          key={listing._id}
                          onClick={() => openListing(listing)}
                          className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-base-200"
                        >
                          {listing.imageUrls?.[0] || listing.imageUrl ? (
                            <img
                              src={listing.imageUrls?.[0] || listing.imageUrl}
                              alt=""
                              className="size-12 rounded-lg object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <span className="flex size-12 items-center justify-center rounded-lg bg-base-200">
                              <PackageOpen className="size-5 opacity-40" />
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">
                              {listing.title}
                            </span>
                            <span className="text-xs opacity-60">
                              {priceLabel(listing)}
                            </span>
                          </span>
                        </button>
                      ))}
                      {!sellerListingsQuery.isLoading &&
                        sellerListings.length === 0 && (
                          <p className="text-xs opacity-50">
                            No other active listings yet.
                          </p>
                        )}
                    </div>
                  </div>
                )}
              </aside>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default MarketplacePanel;
