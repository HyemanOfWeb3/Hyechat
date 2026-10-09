import { useEffect, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Check,
  Clock3,
  MapPin,
  MessageCircle,
  Search,
  ShieldBan,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import UserProfileLink from "../components/UserProfileLink.jsx";
import UserAvatar from "../components/UserAvatar.jsx";
import {
  acceptFriendRequest,
  blockUser,
  cancelFriendRequest,
  declineFriendRequest,
  discoverUsers,
  getBlockedUsers,
  getFriendsPage,
  getRelationshipRequests,
  removeFriend,
  sendFriendRequest,
  unblockUser,
} from "../lib/api.js";

const errorMessage = (error) =>
  error?.response?.data?.message || "Something went wrong";

const Avatar = ({ user }) => (
  <UserAvatar
    src={user?.profilePic}
    name={user?.fullName}
    userId={user?._id}
    alt=""
    className="size-14 text-lg"
  />
);

const UserCard = ({ user, action, busy }) => (
  <article className="card border border-base-300 bg-base-200 shadow-sm transition-shadow hover:shadow-md">
    <div className="card-body gap-4 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <UserProfileLink
          userId={user._id}
          className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          aria-label={`View ${user.fullName}'s profile`}
        >
          <Avatar user={user} />
          <div className="min-w-0">
            <h3 className="truncate font-bold">{user.fullName}</h3>
            {user.location && (
              <p className="mt-1 flex items-center gap-1 truncate text-xs opacity-60">
                <MapPin className="size-3" />
                {user.location}
              </p>
            )}
          </div>
        </UserProfileLink>
      </div>
      {user.bio && (
        <p className="line-clamp-2 text-sm opacity-70">{user.bio}</p>
      )}
      {(user.nativeLanguage ||
        user.learningLanguage ||
        user.interests?.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {user.nativeLanguage && (
            <span className="badge badge-outline badge-sm">
              Speaks {user.nativeLanguage}
            </span>
          )}
          {user.learningLanguage && (
            <span className="badge badge-primary badge-outline badge-sm">
              Learning {user.learningLanguage}
            </span>
          )}
          {(user.interests || []).slice(0, 3).map((interest) => {
            const isShared = (user.sharedInterests || []).some(
              (sharedInterest) =>
                sharedInterest.toLowerCase() === interest.toLowerCase(),
            );
            return (
              <span
                className={`badge badge-sm ${isShared ? "badge-secondary" : "badge-ghost"}`}
                key={interest}
              >
                {isShared ? `Shared · ${interest}` : interest}
              </span>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 text-xs opacity-60">
        {user.mutualFriends > 0 && (
          <span>
            {user.mutualFriends} mutual friend
            {user.mutualFriends === 1 ? "" : "s"}
          </span>
        )}
        {user.relationship === "friends" && (
          <span className="badge badge-success badge-sm gap-1">
            <Check className="size-3" /> Friends
          </span>
        )}
        {(user.relationship === "outgoing" ||
          user.relationshipStatus === "pending_outgoing") && (
          <span className="badge badge-ghost badge-sm gap-1">
            <Clock3 className="size-3" /> Request sent
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {user.relationship === "friends" ? (
          <>
            <Link
              to={`/chat/${user._id}`}
              className="btn btn-primary btn-sm flex-1"
            >
              <MessageCircle className="size-4" /> Message
            </Link>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => action("remove", user._id)}
              disabled={busy}
              aria-label={`Remove ${user.fullName}`}
            >
              <X className="size-4" />
            </button>
          </>
        ) : user.relationship === "outgoing" ||
          user.relationshipStatus === "pending_outgoing" ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm flex-1"
            onClick={() => action("cancel", user.requestId || user._id)}
            disabled={busy}
          >
            Cancel request
          </button>
        ) : user.relationship === "incoming" ? (
          <button
            type="button"
            className="btn btn-primary btn-sm flex-1"
            onClick={() => action("accept", user.requestId)}
            disabled={busy}
          >
            <Check className="size-4" /> Accept
          </button>
        ) : user.relationship === "blocked" ||
          user.relationshipStatus === "blocked" ? (
          <span className="btn btn-disabled btn-sm flex-1">Blocked</span>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-sm flex-1"
            onClick={() => action("send", user._id)}
            disabled={busy}
          >
            <UserPlus className="size-4" /> Add friend
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => action("block", user._id)}
          disabled={busy}
          aria-label={`Block ${user.fullName}`}
        >
          <ShieldBan className="size-4" />
        </button>
      </div>
    </div>
  </article>
);

const BlockedUserCard = ({ user, onUnblock, busy }) => (
  <article className="card border border-base-300 bg-base-200 shadow-sm">
    <div className="card-body flex-row items-center gap-3 p-4">
      <Avatar user={user} />
      <div className="min-w-0 flex-1">
        <UserProfileLink
          userId={user._id}
          className="truncate font-bold hover:text-primary"
        >
          {user.fullName}
        </UserProfileLink>
        {user.location && (
          <p className="truncate text-xs opacity-60">{user.location}</p>
        )}
        <span className="badge badge-ghost badge-sm mt-2">Blocked</span>
      </div>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={() => onUnblock(user._id)}
        disabled={busy}
      >
        Unblock
      </button>
    </div>
  </article>
);

const FriendsPage = ({
  initialTab = "friends",
  exploreMode = false,
  searchQuery,
}) => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(initialTab);
  const [localSearch, setLocalSearch] = useState("");
  const search = searchQuery ?? localSearch;
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      350,
    );
    return () => window.clearTimeout(timer);
  }, [search]);

  const friendsQuery = useInfiniteQuery({
    queryKey: ["friendsPage"],
    queryFn: ({ pageParam }) => getFriendsPage({ page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination?.hasMore ? lastPage.pagination.page + 1 : undefined,
    enabled: !exploreMode,
  });
  const discoveryQuery = useInfiniteQuery({
    queryKey: ["userDiscovery", debouncedSearch],
    queryFn: ({ pageParam }) =>
      discoverUsers({ query: debouncedSearch, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination?.hasMore ? lastPage.pagination.page + 1 : undefined,
    enabled:
      exploreMode ||
      tab === "discover" ||
      tab === "suggestions" ||
      Boolean(debouncedSearch),
  });
  const blockedQuery = useInfiniteQuery({
    queryKey: ["blockedUsers"],
    queryFn: ({ pageParam }) => getBlockedUsers({ page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination?.hasMore ? lastPage.pagination.page + 1 : undefined,
    enabled: tab === "blocked",
  });
  const requestsQuery = useQuery({
    queryKey: ["relationshipRequests"],
    queryFn: getRelationshipRequests,
    enabled: !exploreMode,
  });

  const relationshipMutation = useMutation({
    mutationFn: async ({ type, userId }) => {
      if (type === "send") return sendFriendRequest(userId);
      if (type === "remove") return removeFriend(userId);
      if (type === "cancel") return cancelFriendRequest(userId);
      if (type === "accept") return acceptFriendRequest(userId);
      if (type === "unblock") return unblockUser(userId);
      return blockUser(userId);
    },
    onMutate: async ({ type, userId }) => {
      if (type === "block") {
        await Promise.all([
          queryClient.cancelQueries({ queryKey: ["userDiscovery"] }),
          queryClient.cancelQueries({ queryKey: ["friendsPage"] }),
          queryClient.cancelQueries({ queryKey: ["blockedUsers"] }),
        ]);
        const previousDiscovery = queryClient.getQueriesData({
          queryKey: ["userDiscovery"],
        });
        const previousFriends = queryClient.getQueriesData({
          queryKey: ["friendsPage"],
        });
        const previousBlocked = queryClient.getQueriesData({
          queryKey: ["blockedUsers"],
        });
        let blockedUser;
        queryClient.setQueriesData(
          { queryKey: ["userDiscovery"] },
          (current) => {
            if (!current?.pages) return current;
            return {
              ...current,
              pages: current.pages.map((page) => ({
                ...page,
                users: page.users?.filter((user) => {
                  if (user._id === userId) blockedUser = user;
                  return user._id !== userId;
                }),
              })),
            };
          },
        );
        queryClient.setQueriesData({ queryKey: ["friendsPage"] }, (current) => {
          if (!current?.pages) return current;
          return {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              users: page.users?.filter((user) => {
                if (user._id === userId) blockedUser = user;
                return user._id !== userId;
              }),
            })),
          };
        });
        if (blockedUser) {
          queryClient.setQueriesData(
            { queryKey: ["blockedUsers"] },
            (current) => {
              if (!current?.pages) return current;
              return {
                ...current,
                pages: current.pages.map((page, index) =>
                  index === 0
                    ? {
                        ...page,
                        users: [
                          { ...blockedUser, relationship: "blocked" },
                          ...(page.users || []),
                        ],
                      }
                    : page,
                ),
                pageParams: current.pageParams,
              };
            },
          );
        }
        return { previousDiscovery, previousFriends, previousBlocked };
      }
      if (type === "unblock") {
        await queryClient.cancelQueries({ queryKey: ["blockedUsers"] });
        const blockedPrevious = queryClient.getQueriesData({
          queryKey: ["blockedUsers"],
        });
        queryClient.setQueriesData(
          { queryKey: ["blockedUsers"] },
          (current) => {
            if (!current?.pages) return current;
            return {
              ...current,
              pages: current.pages.map((page) => ({
                ...page,
                users: page.users?.filter((user) => user._id !== userId),
              })),
            };
          },
        );
        return { blockedPrevious };
      }
      if (type !== "send") return undefined;
      await queryClient.cancelQueries({ queryKey: ["userDiscovery"] });
      const previous = queryClient.getQueriesData({
        queryKey: ["userDiscovery"],
      });
      queryClient.setQueriesData({ queryKey: ["userDiscovery"] }, (current) => {
        if (!current?.pages) return current;
        return {
          ...current,
          pages: current.pages.map((page) => ({
            ...page,
            users: page.users?.map((user) =>
              user._id === userId
                ? {
                    ...user,
                    relationship: "outgoing",
                    relationshipStatus: "pending_outgoing",
                    optimistic: true,
                  }
                : user,
            ),
          })),
        };
      });
      return { previous };
    },
    onSuccess: (result, variables) => {
      toast.success(
        variables.type === "send"
          ? "Friend request sent"
          : "Relationship updated",
      );
      queryClient.invalidateQueries({ queryKey: ["friendsPage"] });
      queryClient.invalidateQueries({ queryKey: ["userDiscovery"] });
      queryClient.invalidateQueries({ queryKey: ["relationshipRequests"] });
      queryClient.invalidateQueries({
        queryKey: ["incomingFriendRequestCount"],
      });
      queryClient.invalidateQueries({ queryKey: ["blockedUsers"] });
      if (variables.type === "send" && result?.relationship?.requestId) {
        queryClient.setQueriesData(
          { queryKey: ["userDiscovery"] },
          (current) => {
            if (!current?.pages) return current;
            return {
              ...current,
              pages: current.pages.map((page) => ({
                ...page,
                users: page.users?.map((user) =>
                  user._id === variables.userId
                    ? {
                        ...user,
                        relationship: "outgoing",
                        relationshipStatus: "pending_outgoing",
                        requestId: result.relationship.requestId,
                        optimistic: false,
                      }
                    : user,
                ),
              })),
            };
          },
        );
      }
    },
    onError: (error, variables, context) => {
      context?.previous?.forEach(([queryKey, data]) =>
        queryClient.setQueryData(queryKey, data),
      );
      context?.blockedPrevious?.forEach(([queryKey, data]) =>
        queryClient.setQueryData(queryKey, data),
      );
      context?.previousDiscovery?.forEach(([queryKey, data]) =>
        queryClient.setQueryData(queryKey, data),
      );
      context?.previousFriends?.forEach(([queryKey, data]) =>
        queryClient.setQueryData(queryKey, data),
      );
      toast.error(errorMessage(error));
    },
  });
  const requestMutation = useMutation({
    mutationFn: ({ type, id }) =>
      type === "accept" ? acceptFriendRequest(id) : declineFriendRequest(id),
    onSuccess: () => {
      toast.success("Friend requests updated");
      queryClient.invalidateQueries({ queryKey: ["friendsPage"] });
      queryClient.invalidateQueries({ queryKey: ["userDiscovery"] });
      queryClient.invalidateQueries({ queryKey: ["relationshipRequests"] });
      queryClient.invalidateQueries({
        queryKey: ["incomingFriendRequestCount"],
      });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const action = (type, userId) => {
    if (type === "accept") return relationshipMutation.mutate({ type, userId });
    relationshipMutation.mutate({ type, userId });
  };
  const friends =
    friendsQuery.data?.pages.flatMap((page) => page.users || []) || [];
  const discovered =
    discoveryQuery.data?.pages.flatMap((page) => page.users || []) || [];
  const blockedUsers =
    blockedQuery.data?.pages.flatMap((page) => page.users || []) || [];
  const incoming = requestsQuery.data?.incoming || [];
  const outgoing = requestsQuery.data?.outgoing || [];
  const showingDiscovery =
    tab === "discover" || tab === "suggestions" || Boolean(debouncedSearch);
  const users = showingDiscovery ? discovered : friends;
  const emptyText = showingDiscovery
    ? debouncedSearch
      ? `No users found for "${debouncedSearch}".`
      : "No suggestions available right now."
    : "You haven't added any friends yet.";

  const handleUnblock = (userId) => {
    const user = blockedUsers.find((item) => item._id === userId);
    if (!user || !window.confirm(`Unblock ${user.fullName}?`)) return;
    action("unblock", userId);
  };

  return (
    <div
      className={
        exploreMode
          ? "w-full"
          : "min-h-0 w-full flex-1 overflow-y-auto bg-base-100 px-4 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:px-10"
      }
    >
      <div className={exploreMode ? "w-full" : "mx-auto max-w-6xl space-y-6"}>
        {!exploreMode && (
          <header className="flex flex-col gap-4 border-b border-base-300 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                Community
              </p>
              <h1 className="mt-1 text-3xl font-bold">Friends</h1>
              <p className="mt-2 text-sm opacity-60">
                Find language partners and grow your HyeChat circle.
              </p>
            </div>
            <label className="input input-bordered flex w-full items-center gap-2 sm:max-w-sm">
              <Search className="size-4 opacity-60" />
              <input
                type="search"
                className="grow"
                placeholder="Search people on HyeChat..."
                value={search}
                onChange={(event) => setLocalSearch(event.target.value)}
              />
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => setLocalSearch("")}
                aria-label="Clear search"
              >
                {search && <X className="size-4" />}
              </button>
            </label>
          </header>
        )}

        {!exploreMode && (
          <div className="flex flex-wrap gap-2 border-b border-base-300 pb-3">
            {[
              ["friends", "All friends", friends.length],
              ["requests", "Requests", incoming.length],
              ["sent", "Sent", outgoing.length],
              ["suggestions", "Suggestions", null],
              ["discover", "Discover", null],
              ["blocked", "Blocked users", blockedUsers.length],
            ].map(([id, label, count]) => (
              <button
                type="button"
                key={id}
                onClick={() => setTab(id)}
                className={`btn btn-sm ${tab === id ? "btn-primary" : "btn-ghost"}`}
              >
                {label}
                {count ? <span className="badge badge-sm">{count}</span> : null}
              </button>
            ))}
          </div>
        )}

        {tab === "blocked" ? (
          <section>
            {blockedQuery.isLoading ? (
              <div className="flex justify-center py-16">
                <span className="loading loading-spinner loading-lg" />
              </div>
            ) : blockedUsers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-base-300 p-10 text-center text-sm opacity-60">
                You haven't blocked anyone.
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {blockedUsers.map((user) => (
                    <BlockedUserCard
                      key={user._id}
                      user={user}
                      onUnblock={handleUnblock}
                      busy={relationshipMutation.isPending}
                    />
                  ))}
                </div>
                {blockedQuery.hasNextPage && (
                  <div className="mt-6 flex justify-center">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => blockedQuery.fetchNextPage()}
                      disabled={blockedQuery.isFetchingNextPage}
                    >
                      {blockedQuery.isFetchingNextPage
                        ? "Loading..."
                        : "Load more"}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        ) : tab === "requests" || tab === "sent" ? (
          <section className="space-y-3">
            {(tab === "requests" ? incoming : outgoing).map((request) => {
              const user =
                tab === "requests" ? request.sender : request.recipient;
              return (
                <div
                  key={request._id}
                  className="flex flex-col gap-3 rounded-lg border border-base-300 bg-base-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Avatar user={user} />
                    <div>
                      <p className="font-semibold">{user.fullName}</p>
                      <p className="text-xs opacity-60">
                        {tab === "requests"
                          ? "Wants to connect with you"
                          : "Waiting for a response"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <UserProfileLink
                      userId={user._id}
                      className="btn btn-ghost btn-sm"
                    >
                      View profile
                    </UserProfileLink>
                    {tab === "requests" ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() =>
                            requestMutation.mutate({
                              type: "accept",
                              id: request._id,
                            })
                          }
                          disabled={requestMutation.isPending}
                        >
                          <Check className="size-4" /> Accept
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() =>
                            requestMutation.mutate({
                              type: "decline",
                              id: request._id,
                            })
                          }
                          disabled={requestMutation.isPending}
                        >
                          Decline
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => action("cancel", request._id)}
                        disabled={relationshipMutation.isPending}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {(tab === "requests" ? incoming : outgoing).length === 0 && (
              <div className="rounded-lg border border-dashed border-base-300 p-10 text-center text-sm opacity-60">
                {tab === "requests"
                  ? "No new friend requests."
                  : "You have no pending sent requests."}
              </div>
            )}
          </section>
        ) : (
          <section>
            {friendsQuery.isLoading || discoveryQuery.isLoading ? (
              <div className="flex justify-center py-16">
                <span className="loading loading-spinner loading-lg" />
              </div>
            ) : users.length === 0 ? (
              <div className="rounded-lg border border-dashed border-base-300 p-10 text-center">
                <Users className="mx-auto mb-3 size-8 opacity-40" />
                <p className="font-semibold">{emptyText}</p>
                <p className="mt-1 text-sm opacity-60">
                  Try another search or explore new people.
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {users.map((user) => (
                    <UserCard
                      key={user._id}
                      user={user}
                      action={action}
                      busy={relationshipMutation.isPending}
                    />
                  ))}
                </div>
                <div className="mt-6 flex justify-center">
                  {(showingDiscovery
                    ? discoveryQuery.hasNextPage
                    : friendsQuery.hasNextPage) && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() =>
                        showingDiscovery
                          ? discoveryQuery.fetchNextPage()
                          : friendsQuery.fetchNextPage()
                      }
                      disabled={
                        showingDiscovery
                          ? discoveryQuery.isFetchingNextPage
                          : friendsQuery.isFetchingNextPage
                      }
                    >
                      {(
                        showingDiscovery
                          ? discoveryQuery.isFetchingNextPage
                          : friendsQuery.isFetchingNextPage
                      )
                        ? "Loading..."
                        : "Load more"}
                    </button>
                  )}
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
};

export default FriendsPage;
