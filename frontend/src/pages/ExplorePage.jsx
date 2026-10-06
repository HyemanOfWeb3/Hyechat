import { createElement, useEffect, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  Compass,
  GraduationCap,
  Globe2,
  MapPin,
  PackageOpen,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  UsersRound,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import FriendsPage from "./FriendsPage.jsx";
import {
  createMarketplaceListing,
  getDiscoverableCommunities,
  getMarketplaceListings,
  joinPublicCommunity,
} from "../lib/api.js";

const sections = [
  { id: "people", label: "People", icon: UsersRound },
  { id: "marketplace", label: "Marketplace", icon: Store },
  { id: "communities", label: "Communities", icon: Globe2 },
];

const listingTypes = [
  { value: "physical_product", label: "Physical products", icon: ShoppingBag },
  { value: "digital_product", label: "Digital products", icon: PackageOpen },
  { value: "service", label: "Services", icon: BriefcaseBusiness },
  { value: "creator_offering", label: "Creator offerings", icon: Sparkles },
  { value: "business", label: "Businesses", icon: Store },
  { value: "course", label: "Courses", icon: GraduationCap },
  { value: "event", label: "Events", icon: CalendarDays },
];

const listingTypeLabel = (type) =>
  listingTypes.find((item) => item.value === type)?.label || "Marketplace";

const ExploreSectionHeading = ({ title, description, action }) => (
  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h2 id={`explore-${title.toLowerCase()}-heading`} className="text-xl font-bold">{title}</h2>
      {description && <p className="mt-1 text-sm opacity-60">{description}</p>}
    </div>
    {action}
  </div>
);

const ExplorePage = () => {
  const queryClient = useQueryClient();
  const [section, setSection] = useState("people");
  const [searchCategory, setSearchCategory] = useState(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [listingType, setListingType] = useState("");
  const [showListingForm, setShowListingForm] = useState(false);
  const [listingForm, setListingForm] = useState({
    title: "",
    description: "",
    type: "physical_product",
    category: "",
    price: "",
    imageUrl: "",
    location: "",
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const hasSearch = Boolean(debouncedSearch);
  const communitiesQuery = useInfiniteQuery({
    queryKey: ["explore", "communities", debouncedSearch],
    queryFn: ({ pageParam }) =>
      getDiscoverableCommunities({ query: debouncedSearch, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination?.hasMore ? lastPage.pagination.page + 1 : undefined,
    enabled: hasSearch || section === "communities",
  });
  const marketplaceQuery = useInfiniteQuery({
    queryKey: ["explore", "marketplace", debouncedSearch, listingType],
    queryFn: ({ pageParam }) =>
      getMarketplaceListings({
        query: debouncedSearch,
        type: hasSearch ? "" : listingType,
        page: pageParam,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination?.hasMore ? lastPage.pagination.page + 1 : undefined,
    enabled: hasSearch || section === "marketplace",
  });

  const joinMutation = useMutation({
    mutationFn: joinPublicCommunity,
    onSuccess: (_result, communityId) => {
      queryClient.invalidateQueries({ queryKey: ["explore", "communities"] });
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      toast.success("You joined the community");
      if (communityId) queryClient.invalidateQueries({ queryKey: ["community", communityId] });
    },
    onError: (error) =>
      toast.error(error.response?.data?.message || "Unable to join this community"),
  });

  const createListingMutation = useMutation({
    mutationFn: createMarketplaceListing,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["explore", "marketplace"] });
      setListingForm({
        title: "",
        description: "",
        type: "physical_product",
        category: "",
        price: "",
        imageUrl: "",
        location: "",
      });
      setShowListingForm(false);
      toast.success("Your listing is live in Explore");
    },
    onError: (error) =>
      toast.error(error.response?.data?.message || "Unable to create listing"),
  });

  const communities =
    communitiesQuery.data?.pages.flatMap((page) => page.communities || []) || [];
  const listings =
    marketplaceQuery.data?.pages.flatMap((page) => page.listings || []) || [];
  const activeSection = sections.find((item) => item.id === section);

  const renderPeople = () => (
    <section aria-labelledby="explore-people-heading">
      <ExploreSectionHeading
        title="People"
        description="Find language partners by language, profile, and shared interests."
      />
      <FriendsPage
        key={`people-${debouncedSearch}`}
        initialTab="discover"
        exploreMode
        searchQuery={debouncedSearch}
      />
    </section>
  );

  const renderCommunities = () => (
    <section aria-labelledby="explore-communities-heading">
      <ExploreSectionHeading
        title="Communities"
        description="Discover public spaces. Private communities stay invite-only."
        action={
          <Link to="/communities" className="btn btn-outline btn-sm">
            Manage my communities <ArrowUpRight className="size-4" />
          </Link>
        }
      />
      {communitiesQuery.isLoading ? (
        <div className="flex justify-center py-14"><span className="loading loading-spinner loading-lg" /></div>
      ) : communitiesQuery.isError ? (
        <div className="alert alert-error">Unable to load public communities right now.</div>
      ) : communities.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-base-300 p-10 text-center">
          <Globe2 className="mx-auto mb-3 size-9 opacity-40" />
          <p className="font-semibold">No public communities found</p>
          <p className="mt-1 text-sm opacity-60">Try another search, or create a public community from Communities.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {communities.map((community) => (
            <article key={community._id} className="card border border-base-300 bg-base-200 shadow-sm">
              <div className="card-body gap-3 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="avatar shrink-0">
                    <div className="size-14 rounded-xl bg-primary/15 text-primary">
                      {community.avatar ? <img src={community.avatar} alt="" /> : <span className="flex size-full items-center justify-center text-xl font-bold">{community.name?.charAt(0)?.toUpperCase() || "C"}</span>}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-bold">{community.name}</h3>
                    <p className="text-xs opacity-60">{community.memberCount || 0} members{community.category ? ` · ${community.category}` : ""}</p>
                  </div>
                  <span className="badge badge-primary badge-outline">Public</span>
                </div>
                <p className="line-clamp-3 min-h-12 text-sm opacity-70">{community.description || "A public HyeChat community."}</p>
                {community.owner?.fullName && <p className="text-xs opacity-60">Hosted by {community.owner.fullName}</p>}
                {community.isMember ? (
                  <Link to={`/communities/${community._id}`} className="btn btn-outline btn-sm mt-auto">Open community</Link>
                ) : (
                  <button type="button" className="btn btn-primary btn-sm mt-auto" onClick={() => joinMutation.mutate(community._id)} disabled={joinMutation.isPending}>Join community</button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {communitiesQuery.hasNextPage && (
        <div className="mt-5 flex justify-center">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => communitiesQuery.fetchNextPage()} disabled={communitiesQuery.isFetchingNextPage}>
            {communitiesQuery.isFetchingNextPage ? "Loading…" : "Load more communities"}
          </button>
        </div>
      )}
    </section>
  );

  const renderMarketplace = () => (
    <section aria-labelledby="explore-marketplace-heading">
      <ExploreSectionHeading
        title="Marketplace"
        description="Discover products, services, creators, businesses, courses, and events."
        action={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowListingForm((open) => !open)}>
            <Plus className="size-4" /> Create listing
          </button>
        }
      />
      {showListingForm && (
        <form
          className="mb-5 rounded-2xl border border-base-300 bg-base-200 p-4 sm:p-6"
          onSubmit={(event) => {
            event.preventDefault();
            createListingMutation.mutate({
              ...listingForm,
              price: listingForm.price === "" ? null : Number(listingForm.price),
            });
          }}
        >
          <h3 className="mb-4 text-lg font-bold">Create a discoverable listing</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="form-control sm:col-span-2">
              <span className="label-text mb-1 font-semibold">Title</span>
              <input className="input input-bordered" value={listingForm.title} onChange={(event) => setListingForm({ ...listingForm, title: event.target.value })} minLength={3} maxLength={100} required />
            </label>
            <label className="form-control">
              <span className="label-text mb-1 font-semibold">Offering type</span>
              <select className="select select-bordered" value={listingForm.type} onChange={(event) => setListingForm({ ...listingForm, type: event.target.value })}>
                {listingTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="form-control">
              <span className="label-text mb-1 font-semibold">Category</span>
              <input className="input input-bordered" value={listingForm.category} onChange={(event) => setListingForm({ ...listingForm, category: event.target.value })} maxLength={60} placeholder="Language learning" />
            </label>
            <label className="form-control sm:col-span-2">
              <span className="label-text mb-1 font-semibold">Description</span>
              <textarea className="textarea textarea-bordered min-h-24" value={listingForm.description} onChange={(event) => setListingForm({ ...listingForm, description: event.target.value })} maxLength={2000} />
            </label>
            <label className="form-control">
              <span className="label-text mb-1 font-semibold">Price (optional)</span>
              <input type="number" className="input input-bordered" value={listingForm.price} onChange={(event) => setListingForm({ ...listingForm, price: event.target.value })} min="0" step="0.01" />
            </label>
            <label className="form-control">
              <span className="label-text mb-1 font-semibold">Location (optional)</span>
              <input className="input input-bordered" value={listingForm.location} onChange={(event) => setListingForm({ ...listingForm, location: event.target.value })} maxLength={120} />
            </label>
            <label className="form-control sm:col-span-2">
              <span className="label-text mb-1 font-semibold">Image URL (optional)</span>
              <input type="url" className="input input-bordered" value={listingForm.imageUrl} onChange={(event) => setListingForm({ ...listingForm, imageUrl: event.target.value })} placeholder="https://..." />
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowListingForm(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={createListingMutation.isPending}>{createListingMutation.isPending ? "Publishing…" : "Publish listing"}</button>
          </div>
          <p className="mt-3 text-xs opacity-60">This creates a discovery listing; checkout and payments are not part of this foundation.</p>
        </form>
      )}
      {!hasSearch && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2" aria-label="Marketplace listing filters">
          <button type="button" className={`btn btn-xs shrink-0 ${listingType === "" ? "btn-primary" : "btn-ghost"}`} onClick={() => setListingType("")}>All offerings</button>
          {listingTypes.map((item) => (
            <button type="button" key={item.value} className={`btn btn-xs shrink-0 ${listingType === item.value ? "btn-primary" : "btn-ghost"}`} onClick={() => setListingType(item.value)}>{item.label}</button>
          ))}
        </div>
      )}
      {marketplaceQuery.isLoading ? (
        <div className="flex justify-center py-14"><span className="loading loading-spinner loading-lg" /></div>
      ) : marketplaceQuery.isError ? (
        <div className="alert alert-error">Unable to load marketplace listings right now.</div>
      ) : listings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-base-300 p-10 text-center">
          <PackageOpen className="mx-auto mb-3 size-9 opacity-40" />
          <p className="font-semibold">No listings found</p>
          <p className="mt-1 text-sm opacity-60">Try a different search or create the first listing.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {listings.map((listing) => (
            <article key={listing._id} className="card overflow-hidden border border-base-300 bg-base-200 shadow-sm">
              {listing.imageUrl ? <img src={listing.imageUrl} alt="" className="h-40 w-full object-cover" loading="lazy" /> : <div className="flex h-32 items-center justify-center bg-base-300/60"><PackageOpen className="size-9 opacity-35" /></div>}
              <div className="card-body gap-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="badge badge-secondary badge-outline">{listingTypeLabel(listing.type)}</span>
                  {listing.price !== null && listing.price !== undefined && <span className="font-bold">{listing.currency || "USD"} {Number(listing.price).toFixed(2)}</span>}
                </div>
                <h3 className="line-clamp-2 font-bold">{listing.title}</h3>
                {listing.category && <p className="text-xs opacity-60">{listing.category}</p>}
                <p className="line-clamp-3 text-sm opacity-70">{listing.description || "Discover this HyeChat offering."}</p>
                <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-xs opacity-60">
                  <span className="truncate">{listing.seller?.fullName || "HyeChat member"}</span>
                  {listing.location && <span className="flex shrink-0 items-center gap-1"><MapPin className="size-3" />{listing.location}</span>}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {marketplaceQuery.hasNextPage && (
        <div className="mt-5 flex justify-center">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => marketplaceQuery.fetchNextPage()} disabled={marketplaceQuery.isFetchingNextPage}>
            {marketplaceQuery.isFetchingNextPage ? "Loading…" : "Load more listings"}
          </button>
        </div>
      )}
    </section>
  );

  return (
    <div className="min-h-0 w-full flex-1 overflow-y-auto bg-base-100 px-4 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-7 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-4 border-b border-base-300 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Compass className="size-6" /></div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Explore HyeChat</p>
              <h1 className="text-2xl font-bold sm:text-3xl">Find your next connection</h1>
            </div>
          </div>
          <label className="input input-bordered flex w-full items-center gap-2 rounded-2xl bg-base-200">
            <Search className="size-5 shrink-0 opacity-60" />
            <input type="search" className="grow" placeholder="Search people, communities, or offerings…" value={search} onChange={(event) => { setSearch(event.target.value); setSearchCategory(null); }} aria-label="Search all of Explore" />
            {search && <button type="button" className="btn btn-ghost btn-xs btn-square" aria-label="Clear search" onClick={() => { setSearch(""); setSearchCategory(null); }}><X className="size-4" /></button>}
          </label>
          <nav className="-mb-5 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Explore categories">
            {sections.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" role="tab" aria-selected={section === id} aria-controls={`explore-panel-${id}`} onClick={() => { setSection(id); setSearchCategory(hasSearch ? id : null); }} className={`btn btn-sm shrink-0 rounded-full sm:btn-md ${section === id ? "btn-primary" : "btn-ghost"}`}>
                {createElement(Icon, { className: "size-4" })} {label}
              </button>
            ))}
          </nav>
        </header>

        {hasSearch && !searchCategory ? (
          <div className="space-y-8" aria-live="polite">
            <p className="text-sm opacity-60">Separate results for <span className="font-semibold text-base-content">“{debouncedSearch}”</span></p>
            {renderPeople()}
            <div className="border-t border-base-300 pt-6">{renderCommunities()}</div>
            <div className="border-t border-base-300 pt-6">{renderMarketplace()}</div>
          </div>
        ) : (
          <div id={`explore-panel-${section}`} role="tabpanel" aria-label={activeSection?.label}>
            {(searchCategory || section) === "people" && renderPeople()}
            {(searchCategory || section) === "communities" && renderCommunities()}
            {(searchCategory || section) === "marketplace" && renderMarketplace()}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExplorePage;
