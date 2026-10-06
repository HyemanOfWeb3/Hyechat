import { useEffect, useMemo, useState } from "react";
import { Search, MessageSquare, RefreshCw } from "lucide-react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import useStreamClient from "../hooks/useStreamClient.js";
import { getUserFriends } from "../lib/api.js";
import useAuthUser from "../hooks/useAuthUser.js";
import ChatLoader from "../components/ChatLoader.jsx";
import ChatList from "../components/ChatList.jsx";
import StoriesBar from "../components/stories/StoriesBar.jsx";

const ChatsPage = () => {
  const { authUser } = useAuthUser();
  const [chatClient, setChatClient] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [conversationError, setConversationError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // Use persistent shared Stream client
  const { client: streamClient, connectionState } = useStreamClient();

  const { data: friends = [], isLoading: friendsLoading } = useQuery({
    queryKey: ["friends"],
    queryFn: getUserFriends,
    enabled: !!authUser,
  });

  const conversationQuery = useInfiniteQuery({
    queryKey: ["chatChannels", authUser?._id],
    enabled: !!authUser && !!streamClient && connectionState === "connected",
    queryFn: async ({ pageParam = 0 }) => {
      const channels = await streamClient.queryChannels(
        { type: "messaging", members: { $in: [authUser._id] } },
        { last_message_at: -1 },
        { limit: 20, offset: pageParam, state: true, watch: true, presence: true },
      );
      return channels;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length < 20) return undefined;
      return allPages.length * 20;
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!authUser || !streamClient || connectionState !== "connected")
      return undefined;

    let isActive = true;

    const loadConversations = async () => {
      setIsLoadingConversations(true);
      setConversationError("");

      try {
        const channels = conversationQuery.data?.pages.flat() ?? [];
        if (isActive) {
          setChatClient(streamClient);
          setConversations(channels);
        }
      } catch (error) {
        console.error("Error loading conversations:", error);
        if (isActive) {
          setConversationError(
            "Unable to load your conversations right now. Please try again.",
          );
        }
      } finally {
        if (isActive) setIsLoadingConversations(false);
      }
    };

    loadConversations();

    return () => {
      isActive = false;
    };
  }, [authUser, streamClient, connectionState, reloadKey, conversationQuery.data]);

  const friendById = useMemo(
    () => new Map(friends.map((friend) => [friend._id, friend])),
    [friends],
  );

  const filteredConversations = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return conversations.filter((channel) => {
      const otherMember = Object.values(channel.state?.members || {}).find(
        (member) => member.user_id !== authUser?._id,
      );
      const friend = otherMember?.user_id
        ? friendById.get(otherMember.user_id)
        : null;
      const name =
        friend?.fullName || otherMember?.user?.name || "Conversation";
      return name.toLowerCase().includes(normalizedQuery);
    });
  }, [authUser?._id, conversations, friendById, searchQuery]);

  const handleRetry = () => {
    setReloadKey((key) => key + 1);
    void conversationQuery.refetch();
  };

  const handleLoadMore = () => {
    if (conversationQuery.hasNextPage && !conversationQuery.isFetchingNextPage) {
      void conversationQuery.fetchNextPage();
    }
  };

  if (friendsLoading) return <ChatLoader />;

  return (
    <div className="min-h-0 w-full overflow-y-auto bg-base-100 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-full bg-primary/15 text-primary">
            <MessageSquare className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Chats
            </h1>
            <p className="text-sm opacity-70">Your recent conversations</p>
          </div>
        </div>

        <label className="input input-bordered mb-6 flex w-full items-center gap-2">
          <Search className="size-4 opacity-60" />
          <input
            type="search"
            placeholder="Search conversations"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="grow"
          />
        </label>

        <section className="mb-8 border-b border-base-300 pb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Stories</h2>
            <span className="text-xs opacity-60">Coming soon</span>
          </div>
          <StoriesBar chatClient={chatClient} />
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Chats</h2>
            <span className="text-sm opacity-60">
              {filteredConversations.length}
            </span>
          </div>

          {conversationError ? (
            <div className="alert alert-error flex items-center justify-between">
              <span>{conversationError}</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleRetry}
                title="Retry loading conversations"
              >
                <RefreshCw className="size-4" />
              </button>
            </div>
          ) : isLoadingConversations ? (
            <div className="flex justify-center py-12">
              <span className="loading loading-spinner loading-lg" />
            </div>
          ) : (
            <ChatList
              channels={filteredConversations}
              currentUserId={authUser?._id}
              friendById={friendById}
              chatClient={chatClient}
              hasSearchQuery={Boolean(searchQuery.trim())}
              hasMore={Boolean(conversationQuery.hasNextPage)}
              isLoadingMore={conversationQuery.isFetchingNextPage}
              onLoadMore={handleLoadMore}
            />
          )}
        </section>
      </div>
    </div>
  );
};

export default ChatsPage;
