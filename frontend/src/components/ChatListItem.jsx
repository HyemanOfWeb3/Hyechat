import { Link } from "react-router-dom";
import { MessageCircle } from "lucide-react";

const formatTimestamp = (value) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 1000),
  );
  if (elapsedSeconds < 60) return "now";
  if (elapsedSeconds < 3600) return `${Math.floor(elapsedSeconds / 60)}m`;
  if (elapsedSeconds < 86400) return `${Math.floor(elapsedSeconds / 3600)}h`;
  if (elapsedSeconds < 604800) return `${Math.floor(elapsedSeconds / 86400)}d`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

const getChannelMembers = (channel) => {
  const stateMembers = Object.values(channel.state?.members || {});
  const dataMembers = Array.isArray(channel.data?.members)
    ? channel.data.members
    : [];
  const members = [...stateMembers, ...dataMembers];

  return members.filter(
    (member, index, allMembers) =>
      allMembers.findIndex(
        (candidate) => getMemberId(candidate) === getMemberId(member),
      ) === index,
  );
};

const getMemberId = (member) =>
  member?.user_id || member?.user?.id || member?.user?._id || member?.id || "";

const ChatListItem = ({ channel, currentUserId, friendById }) => {
  const isCommunity = Boolean(channel.data?.community);
  const otherMember = getChannelMembers(channel).find(
    (member) => String(getMemberId(member)) !== String(currentUserId),
  );
  const peerPresence = otherMember?.user || otherMember || {};
  const peerOnline = Boolean(
    peerPresence.online || peerPresence.presence?.online,
  );
  const lastSeen = peerPresence.last_active || peerPresence.last_active_at;
  const userId = getMemberId(otherMember);
  const channelTargetId =
    userId ||
    channel?.data?.channel_id ||
    channel?.data?.conversation_id ||
    channel?.cid?.split(":").at(-1) ||
    channel?.id;
  const safeChatTargetId =
    typeof channelTargetId === "string" && channelTargetId.trim()
      ? channelTargetId.trim()
      : "";
  const friend = safeChatTargetId
    ? friendById.get(userId || safeChatTargetId)
    : null;
  const name =
    (isCommunity ? channel.data?.name : null) ||
    friend?.fullName ||
    otherMember?.user?.name ||
    otherMember?.name ||
    userId ||
    "Conversation";
  const avatar =
    (isCommunity ? channel.data?.image : null) ||
    friend?.profilePic ||
    otherMember?.user?.image ||
    otherMember?.image;
  const lastMessage = channel.state?.messages?.at(-1);
  const preview =
    lastMessage?.text ||
    (lastMessage?.attachments?.length ? "Attachment" : "No messages yet");
  const timestamp = lastMessage?.created_at || channel.data?.last_message_at;
  const unreadCount =
    channel.state?.unreadCount || channel.countUnread?.() || 0;

  if (!safeChatTargetId && !isCommunity) return null;

  return (
    <Link
      to={
        isCommunity
          ? `/communities/${channel.data.community_id}`
          : `/chat/${encodeURIComponent(safeChatTargetId)}`
      }
      aria-label={`Open chat with ${name}`}
      className="flex min-w-0 items-center gap-3 border-b border-base-300 px-4 py-4 transition-colors last:border-b-0 hover:bg-base-300/60 active:bg-base-300/80"
    >
      <div className="relative shrink-0">
        <div className="avatar">
          <div className="size-12 rounded-full bg-base-300">
            {avatar ? (
              <img src={avatar} alt={`${name}'s profile`} />
            ) : (
              <div className="flex size-full items-center justify-center text-lg font-semibold opacity-70">
                {name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>
        {(peerOnline || friend?.isOnline) && (
          <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-base-200 bg-success" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <h3 className="truncate font-semibold">{name}</h3>
          <time className="shrink-0 text-xs opacity-60">
            {formatTimestamp(timestamp)}
          </time>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="truncate text-sm opacity-70">{preview}</p>
          {unreadCount > 0 && (
            <span className="badge badge-primary badge-sm shrink-0">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="mt-1 text-[11px] text-slate-500">
          {peerOnline
            ? "Online"
            : lastSeen
              ? `Last active ${formatTimestamp(lastSeen)}`
              : "Offline"}
        </div>
      </div>
      <MessageCircle className="size-4 shrink-0 opacity-40" />
    </Link>
  );
};

export default ChatListItem;
