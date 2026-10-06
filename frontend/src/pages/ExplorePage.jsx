import { createElement, useEffect, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ArrowUpRight,
  Compass,
  Globe2,
  Search,
  Store,
  UsersRound,
  X,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import FriendsPage from "./FriendsPage.jsx";
import MarketplacePanel from "../components/marketplace/MarketplacePanel.jsx";
import { getDiscoverableCommunities, joinPublicCommunity } from "../lib/api.js";

const sections = [
  { id: "people", label: "People", icon: UsersRound },
  { id: "marketplace", label: "Marketplace", icon: Store },
  { id: "communities", label: "Communities", icon: Globe2 },
];

const ExploreSectionHeading = ({ id, title, description, action }) => (
  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h2 id={id} className="text-xl font-bold">
        {title}
      </h2>
      {description && <p className="mt-1 text-sm opacity-60">{description}</p>}
    </div>
    {action}
  </div>
);

const ExplorePage = () => {
  const queryClient = useQueryClient();
  const [urlSearchParams] = useSearchParams();
  const [section, setSection] = useState(() =>
    urlSearchParams.has("listing") ? "marketplace" : "people",
  );
  const [searchCategory, setSearchCategory] = useState(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      300,
    );
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

  const joinMutation = useMutation({
    mutationFn: joinPublicCommunity,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["explore", "communities"] });
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      toast.success("You joined the community");
    },
    onError: (error) =>
      toast.error(
        error.response?.data?.message || "Unable to join this community",
      ),
  });

  const communities =
    communitiesQuery.data?.pages.flatMap((page) => page.communities || []) ||
    [];
  const activeSection = sections.find((item) => item.id === section);

  const renderPeople = () => (
    <section aria-labelledby="explore-people-heading">
      <ExploreSectionHeading
        id="explore-people-heading"
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
        id="explore-communities-heading"
        title="Communities"
        description="Discover public spaces. Private communities stay invite-only."
        action={
          <Link to="/communities" className="btn btn-outline btn-sm">
            Manage my communities <ArrowUpRight className="size-4" />
          </Link>
        }
      />
      {communitiesQuery.isLoading ? (
        <div className="flex justify-center py-14">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : communitiesQuery.isError ? (
        <div className="alert alert-error">
          Unable to load public communities right now.
        </div>
      ) : communities.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-base-300 p-10 text-center">
          <Globe2 className="mx-auto mb-3 size-9 opacity-40" />
          <p className="font-semibold">No public communities found</p>
          <p className="mt-1 text-sm opacity-60">
            Try another search, or create a public community from Communities.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {communities.map((community) => (
            <article
              key={community._id}
              className="card border border-base-300 bg-base-200 shadow-sm"
            >
              <div className="card-body gap-3 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="avatar shrink-0">
                    <div className="size-14 rounded-xl bg-primary/15 text-primary">
                      {community.avatar ? (
                        <img src={community.avatar} alt="" loading="lazy" />
                      ) : (
                        <span className="flex size-full items-center justify-center text-xl font-bold">
                          {community.name?.charAt(0)?.toUpperCase() || "C"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-bold">{community.name}</h3>
                    <p className="text-xs opacity-60">
                      {community.memberCount || 0} members
                      {community.category ? ` · ${community.category}` : ""}
                    </p>
                  </div>
                  <span className="badge badge-primary badge-outline">
                    Public
                  </span>
                </div>
                <p className="line-clamp-3 min-h-12 text-sm opacity-70">
                  {community.description || "A public HyeChat community."}
                </p>
                {community.owner?.fullName && (
                  <p className="text-xs opacity-60">
                    Hosted by {community.owner.fullName}
                  </p>
                )}
                {community.isMember ? (
                  <Link
                    to={`/communities/${community._id}`}
                    className="btn btn-outline btn-sm mt-auto"
                  >
                    Open community
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm mt-auto"
                    onClick={() => joinMutation.mutate(community._id)}
                    disabled={joinMutation.isPending}
                  >
                    Join community
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {communitiesQuery.hasNextPage && (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => communitiesQuery.fetchNextPage()}
            disabled={communitiesQuery.isFetchingNextPage}
          >
            {communitiesQuery.isFetchingNextPage
              ? "Loading…"
              : "Load more communities"}
          </button>
        </div>
      )}
    </section>
  );

  const renderMarketplace = () => (
    <MarketplacePanel
      searchQuery={debouncedSearch}
      isMarketplaceScope={!hasSearch || searchCategory === "marketplace"}
    />
  );

  return (
    <div className="min-h-0 w-full flex-1 overflow-y-auto bg-base-100 px-4 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-7 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-4 border-b border-base-300 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Compass className="size-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                Explore HyeChat
              </p>
              <h1 className="text-2xl font-bold sm:text-3xl">
                Find your next connection
              </h1>
            </div>
          </div>
          <label className="input input-bordered flex w-full items-center gap-2 rounded-2xl bg-base-200">
            <Search className="size-5 shrink-0 opacity-60" />
            <input
              type="search"
              className="grow"
              placeholder="Search people, communities, or offerings…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setSearchCategory(null);
              }}
              aria-label="Search all of Explore"
            />
            {search && (
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-square"
                aria-label="Clear search"
                onClick={() => {
                  setSearch("");
                  setSearchCategory(null);
                }}
              >
                <X className="size-4" />
              </button>
            )}
          </label>
          <nav
            className="-mb-5 flex gap-2 overflow-x-auto pb-1"
            role="tablist"
            aria-label="Explore categories"
          >
            {sections.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={section === id}
                aria-controls={`explore-panel-${id}`}
                onClick={() => {
                  setSection(id);
                  setSearchCategory(hasSearch ? id : null);
                }}
                className={`btn btn-sm shrink-0 rounded-full sm:btn-md ${section === id ? "btn-primary" : "btn-ghost"}`}
              >
                {createElement(Icon, { className: "size-4" })} {label}
              </button>
            ))}
          </nav>
        </header>

        {hasSearch && !searchCategory ? (
          <div className="space-y-8" aria-live="polite">
            <p className="text-sm opacity-60">
              Separate results for{" "}
              <span className="font-semibold text-base-content">
                “{debouncedSearch}”
              </span>
            </p>
            {renderPeople()}
            <div className="border-t border-base-300 pt-6">
              {renderCommunities()}
            </div>
            <div className="border-t border-base-300 pt-6">
              {renderMarketplace()}
            </div>
          </div>
        ) : (
          <div
            id={`explore-panel-${section}`}
            role="tabpanel"
            aria-label={activeSection?.label}
          >
            {(searchCategory || section) === "people" && renderPeople()}
            {(searchCategory || section) === "communities" &&
              renderCommunities()}
            {(searchCategory || section) === "marketplace" &&
              renderMarketplace()}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExplorePage;
