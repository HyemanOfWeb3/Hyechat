import ChatListItem from "./ChatListItem.jsx";

const ChatList = ({
  channels,
  currentUserId,
  friendById,
  hasSearchQuery,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
}) => {
  if (!channels.length) {
    return (
      <div className="card bg-base-200 p-6 text-center">
        <h3 className="text-lg font-semibold">
          {hasSearchQuery ? "No conversations found" : "No conversations yet"}
        </h3>
        <p className="mt-2 text-sm opacity-70">
          {hasSearchQuery
            ? "Try a different search term."
            : "Start a conversation with one of your friends."}
        </p>
      </div>
    );
  }

  const directChannels = channels.filter((channel) => !channel.data?.community);
  const communityChannels = channels.filter(
    (channel) => channel.data?.community,
  );
  const renderChannels = (sectionChannels) => (
    <div className="overflow-hidden rounded-xl border border-base-300 bg-base-200">
      {sectionChannels.map((channel) => (
        <ChatListItem
          key={channel.cid || channel.id}
          channel={channel}
          currentUserId={currentUserId}
          friendById={friendById}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {directChannels.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.16em] opacity-55">
            Direct conversations
          </h3>
          {renderChannels(directChannels)}
        </section>
      )}
      {communityChannels.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.16em] opacity-55">
            Communities
          </h3>
          {renderChannels(communityChannels)}
        </section>
      )}
      {hasMore && (
        <div className="pt-2">
          <button
            type="button"
            className="btn btn-outline btn-sm w-full"
            onClick={onLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? "Loading more chats..." : "Load older chats"}
          </button>
        </div>
      )}
    </div>
  );
};

export default ChatList;
