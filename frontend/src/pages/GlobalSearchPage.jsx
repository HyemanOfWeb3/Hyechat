import { createElement, useEffect, useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowUpRight,
  BadgeCheck,
  Compass,
  Globe2,
  MapPin,
  MessageCircle,
  PackageOpen,
  Search,
  Store,
  UsersRound,
} from "lucide-react";
import { joinPublicCommunity, searchGlobalCategory } from "../lib/api.js";
import UserProfileLink from "../components/UserProfileLink.jsx";

const categories = [
  { id: "people", label: "People", icon: UsersRound, verb: "people" },
  { id: "communities", label: "Communities", icon: Globe2, verb: "communities" },
  { id: "marketplace", label: "Marketplace", icon: Store, verb: "listings" },
];

const useCategorySearch = (category, query) =>
  useInfiniteQuery({
    queryKey: ["globalSearch", category, query],
    queryFn: ({ pageParam }) =>
      searchGlobalCategory(category, { query, page: pageParam, limit: 8 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination?.hasMore ? lastPage.pagination.page + 1 : undefined,
    enabled: query.length >= 2,
  });

const ResultSection = ({ id, title, icon: Icon, query, search, renderItem }) => {
  const result = useCategorySearch(id, query);
  const items = result.data?.pages.flatMap((page) => page.results || []) || [];

  return (
    <section aria-labelledby={`global-search-${id}`} className="space-y-3">
      <div className="flex items-center justify-between gap-3 border-b border-base-300 pb-2">
        <h2 id={`global-search-${id}`} className="flex items-center gap-2 text-lg font-bold">
          {createElement(Icon, { className: "size-5 text-primary" })} {title}
        </h2>
        {result.data && <span className="badge badge-ghost">{items.length} shown</span>}
      </div>
      {query.length < 2 ? (
        <p className="rounded-xl bg-base-200 p-4 text-sm opacity-60">Enter at least 2 characters to search {title.toLowerCase()}.</p>
      ) : result.isLoading ? (
        <div className="flex justify-center py-6"><span className="loading loading-spinner loading-md" /></div>
      ) : result.isError ? (
        <div className="alert alert-error text-sm">Could not load {title.toLowerCase()} results.</div>
      ) : items.length === 0 ? (
        <p className="rounded-xl bg-base-200 p-4 text-sm opacity-60">No {title.toLowerCase()} matched “{search}”.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => renderItem(item))}
          </div>
          {result.hasNextPage && (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => result.fetchNextPage()}
                disabled={result.isFetchingNextPage}
              >
                {result.isFetchingNextPage ? "Loading…" : `Load more ${result.data?.pages[0]?.pagination?.totalLabel || title.toLowerCase()}`}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};

const PersonResult = ({ person }) => (
  <article className="flex min-w-0 items-center gap-3 rounded-xl border border-base-300 bg-base-200 p-3">
    <UserProfileLink
      userId={person._id}
      className="avatar shrink-0"
      aria-label={`View ${person.fullName}'s profile`}
    >
      <div className="size-12 rounded-full bg-base-300">
        {person.profilePic ? (
          <img src={person.profilePic} alt="" loading="lazy" />
        ) : (
          <span className="flex size-full items-center justify-center font-bold">
            {person.fullName?.charAt(0)?.toUpperCase() || "U"}
          </span>
        )}
      </div>
    </UserProfileLink>
    <div className="min-w-0 flex-1">
      <UserProfileLink userId={person._id} className="flex items-center gap-1 truncate font-semibold hover:text-primary">
        {person.fullName}
        {person.emailVerified && <BadgeCheck className="size-4 shrink-0 text-info" aria-label="Email verified" />}
      </UserProfileLink>
      <p className="truncate text-xs opacity-60">
        {person.nativeLanguage && `Speaks ${person.nativeLanguage}`}
        {person.nativeLanguage && person.learningLanguage && " · "}
        {person.learningLanguage && `Learning ${person.learningLanguage}`}
      </p>
      {person.interests?.length > 0 && (
        <p className="mt-1 truncate text-xs opacity-60">{person.interests.slice(0, 3).join(" · ")}</p>
      )}
    </div>
    <Link to={`/chat/${encodeURIComponent(person._id)}`} className="btn btn-ghost btn-square btn-sm" aria-label={`Open conversation with ${person.fullName}`}>
      <MessageCircle className="size-4" />
    </Link>
  </article>
);

const CommunityResult = ({ community, onJoin, isJoining }) => (
  <article className="flex min-w-0 items-center gap-3 rounded-xl border border-base-300 bg-base-200 p-3">
    <div className="avatar shrink-0">
      <div className="size-12 rounded-xl bg-primary/10">
        {community.avatar ? (
          <img src={community.avatar} alt="" loading="lazy" />
        ) : (
          <span className="flex size-full items-center justify-center font-bold text-primary">
            {community.name?.charAt(0)?.toUpperCase() || "C"}
          </span>
        )}
      </div>
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate font-semibold">{community.name}</p>
      <p className="truncate text-xs opacity-60">
        Public · {community.memberCount} members{community.category ? ` · ${community.category}` : ""}
      </p>
      {community.description && <p className="mt-1 line-clamp-1 text-xs opacity-60">{community.description}</p>}
    </div>
    {community.isMember ? (
      <Link to={`/communities/${community._id}`} className="btn btn-ghost btn-sm">Open</Link>
    ) : (
      <button type="button" className="btn btn-primary btn-sm" onClick={() => onJoin(community._id)} disabled={isJoining}>Join</button>
    )}
  </article>
);

const MarketplaceResult = ({ listing }) => {
  const image = listing.imageUrls?.[0] || listing.imageUrl;
  return (
    <article className="flex min-w-0 items-center gap-3 rounded-xl border border-base-300 bg-base-200 p-3">
      {image ? (
        <img src={image} alt="" className="size-14 shrink-0 rounded-lg object-cover" loading="lazy" decoding="async" />
      ) : (
        <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-base-300"><PackageOpen className="size-5 opacity-50" /></span>
      )}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 font-semibold">{listing.title}</p>
        <p className="truncate text-xs opacity-60">{listing.category} · {listing.currency || "USD"} {listing.price ?? "Contact for price"}</p>
        <p className="truncate text-xs opacity-60">By {listing.seller?.fullName || "HyeChat seller"}{listing.location ? ` · ${listing.location}` : ""}</p>
      </div>
      <Link to={`/explore?listing=${listing._id}`} className="btn btn-ghost btn-square btn-sm" aria-label={`View listing: ${listing.title}`}>
        <ArrowUpRight className="size-4" />
      </Link>
    </article>
  );
};

const GlobalSearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryFromUrl = searchParams.get("query") || "";
  const [search, setSearch] = useState(queryFromUrl);
  const [debouncedSearch, setDebouncedSearch] = useState(queryFromUrl.trim());
  const queryClient = useQueryClient();

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (debouncedSearch === queryFromUrl) return;
    setSearchParams(
      debouncedSearch ? { query: debouncedSearch } : {},
      { replace: true },
    );
  }, [debouncedSearch, queryFromUrl, setSearchParams]);

  const joinMutation = useMutation({
    mutationFn: (communityId) => joinPublicCommunity(communityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["globalSearch", "communities"] });
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      toast.success("You joined the community");
    },
    onError: (error) => toast.error(error.response?.data?.message || "Unable to join community"),
  });

  const hasSearch = debouncedSearch.length >= 2;

  return (
    <div className="min-h-0 w-full flex-1 overflow-y-auto bg-base-100 px-4 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-7 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-4 border-b border-base-300 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Compass className="size-6" /></div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">HyeChat</p>
              <h1 className="text-2xl font-bold sm:text-3xl">Search</h1>
            </div>
          </div>
          <label className="input input-bordered flex w-full items-center gap-2 rounded-2xl bg-base-200">
            <Search className="size-5 shrink-0 opacity-60" />
            <input
              type="search"
              className="grow"
              autoFocus
              maxLength={100}
              minLength={2}
              placeholder="Search people, communities, and marketplace…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search all of HyeChat"
            />
          </label>
          {hasSearch ? (
            <p className="text-sm opacity-60">Categorized results for <strong className="text-base-content">“{debouncedSearch}”</strong></p>
          ) : (
            <p className="text-sm opacity-60">Search people, public communities, and active marketplace listings. Enter at least 2 characters.</p>
          )}
        </header>

        <div className="space-y-8">
          {categories.map(({ id, label, icon }) => (
            <ResultSection
              key={id}
              id={id}
              title={label}
              icon={icon}
              query={hasSearch ? debouncedSearch : ""}
              search={debouncedSearch}
              renderItem={(item) => {
                if (id === "people") return <PersonResult key={item._id} person={item} />;
                if (id === "communities") {
                  return (
                    <CommunityResult
                      key={item._id}
                      community={item}
                      onJoin={joinMutation.mutate}
                      isJoining={joinMutation.isPending}
                    />
                  );
                }
                return <MarketplaceResult key={item._id} listing={item} />;
              }}
            />
          ))}
        </div>
        <p className="rounded-xl border border-base-300 bg-base-200 p-3 text-xs opacity-60">
          Private messages and ephemeral Stories aren’t included in global search. Message search requires separate privacy and indexing safeguards.
        </p>
      </div>
    </div>
  );
};

export default GlobalSearchPage;
