import { useNavigate } from "react-router-dom";
import {
  CheckIcon,
  MessageCircleIcon,
  Trash2Icon,
  UserRoundIcon,
} from "lucide-react";
import UserProfileLink from "./UserProfileLink.jsx";
import UserAvatar from "./UserAvatar.jsx";

const formatRelativeTime = (value) => {
  if (!value) return "just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "just now";

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

const NotificationItem = ({
  notification,
  onMarkAsRead,
  onDelete,
  isMarkingAsRead = false,
  isDeleting = false,
}) => {
  const navigate = useNavigate();
  const actor = notification.actor || {};
  const actorName = actor.fullName || "Someone";
  const isUnread = notification.read === false;
  const isReply = notification.type === "story_reply";
  const isFriendRequest = notification.type === "friend_request";
  const isFriendAccepted = notification.type === "friend_accepted";
  const isFriendDeclined = notification.type === "friend_declined";
  const isFriendCancelled = notification.type === "friend_cancelled";
  const isFriendRemoved = notification.type === "friend_removed";

  const handleReplyClick = async () => {
    if (isUnread) await onMarkAsRead(notification._id);
    const chatTargetId = actor?._id || actor?.id || "";
    if (chatTargetId) navigate(`/chat/${encodeURIComponent(chatTargetId)}`);
  };

  const handleAction = (action) => (event) => {
    event.stopPropagation();
    action(notification._id);
  };

  const content = (
    <div className="flex min-w-0 items-start gap-3">
      <UserAvatar
        src={actor.profilePic}
        name={actorName}
        userId={actor._id || actor.id}
        alt=""
        className="size-11"
      />

      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-semibold">{actorName}</span>{" "}
          {notification.type === "story_reaction"
            ? "reacted to your story"
            : isReply
              ? "replied to your story"
              : isFriendRequest
                ? "sent you a friend request"
                : isFriendAccepted
                  ? "accepted your friend request"
                  : isFriendDeclined
                    ? "declined your friend request"
                    : isFriendCancelled
                      ? "cancelled a friend request"
                      : isFriendRemoved
                        ? "removed you as a friend"
                        : "sent you a notification"}
        </p>
        {notification.type === "story_reaction" &&
          notification.reactionType && (
            <span className="badge badge-lg mt-2" aria-label="Reaction">
              {notification.reactionType}
            </span>
          )}
        {isReply && (
          <p className="mt-1 flex items-center gap-1 text-xs opacity-70">
            <MessageCircleIcon className="size-3" />
            Tap to view reply
          </p>
        )}
        <p className="mt-2 text-xs opacity-60">
          {formatRelativeTime(notification.createdAt)}
        </p>
      </div>
    </div>
  );

  return (
    <article
      className={`card border shadow-sm ${
        isUnread
          ? "border-primary/40 bg-base-200"
          : "border-base-300 bg-base-200/70"
      }`}
      aria-label={`${actorName} notification`}
    >
      <div className="card-body gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        {isReply && actor._id ? (
          <button
            type="button"
            className="min-w-0 flex-1 cursor-pointer text-left"
            onClick={handleReplyClick}
            aria-label={`Open chat with ${actorName}`}
          >
            {content}
          </button>
        ) : (
          <div className="min-w-0 flex-1">{content}</div>
        )}

        <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
          {isUnread && (
            <button
              type="button"
              className="btn btn-ghost btn-sm gap-1"
              onClick={handleAction(onMarkAsRead)}
              disabled={isMarkingAsRead}
              aria-label={`Mark ${actorName}'s notification as read`}
            >
              {isMarkingAsRead ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <CheckIcon className="size-4" />
              )}
              <span className="hidden sm:inline">Read</span>
            </button>
          )}
          {actor?._id && (
            <UserProfileLink
              userId={actor._id}
              className="btn btn-ghost btn-square btn-sm"
              aria-label={`View ${actorName}'s profile`}
              title="View profile"
            >
              <UserRoundIcon className="size-4" aria-hidden="true" />
            </UserProfileLink>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-square btn-sm"
            onClick={handleAction(onDelete)}
            disabled={isDeleting}
            aria-label={`Delete ${actorName}'s notification`}
          >
            {isDeleting ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <Trash2Icon className="size-4" />
            )}
          </button>
          {isUnread && (
            <span className="badge badge-primary badge-sm">New</span>
          )}
        </div>
      </div>
    </article>
  );
};

export default NotificationItem;
