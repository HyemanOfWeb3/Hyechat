import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  ImageOff,
  LoaderCircle,
  Trash2,
  X,
} from "lucide-react";
import {
  deleteStory,
  viewStory,
  getStoryViewers,
  addStoryReaction,
  removeStoryReaction,
} from "../../lib/api.js";
import { getLanguageFlag } from "../LanguageFlag.jsx";
import { buildChatChannelId } from "../../lib/utils.js";

const getUserId = (user) => {
  if (!user) return "";
  return typeof user === "string" ? user : user._id || user.id || "";
};

const getUserName = (user) => {
  if (!user || typeof user === "string") return user || "User";
  return user.fullName || user.name || "User";
};

const STORY_DURATION_MS = 5000;
const SWIPE_DISTANCE_PX = 50;

const StoryViewer = ({
  groups,
  initialGroupIndex,
  initialStoryIndex,
  currentUserId,
  chatClient,
  onStoryViewed,
  onStoryDeleted,
  onStoryUnavailable,
  onClose,
}) => {
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(initialStoryIndex);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [viewerError, setViewerError] = useState("");
  const [deletedStoryIds, setDeletedStoryIds] = useState(new Set());
  const [replyText, setReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [replyError, setReplyError] = useState("");
  const replyInputRef = useRef(null);
  const viewedStoryIds = useRef(new Set());
  const unavailableStoryIds = useRef(new Set());
  const activeStoryId = useRef(null);
  const pauseReasons = useRef(new Set());
  const playbackElapsed = useRef(0);
  const touchStart = useRef(null);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  const setPauseReason = useCallback((reason, shouldPause) => {
    if (shouldPause) {
      pauseReasons.current.add(reason);
    } else {
      pauseReasons.current.delete(reason);
    }
    setIsPaused(pauseReasons.current.size > 0);
  }, []);

  const resetPlayback = useCallback(() => {
    playbackElapsed.current = 0;
    setProgress(0);
    setImageLoading(true);
    setImageError(false);
    setViewerError("");
  }, []);

  const availableGroups = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          stories: group.stories.filter(
            (story) =>
              !deletedStoryIds.has(story._id) &&
              (!story.expiresAt || new Date(story.expiresAt) > new Date()),
          ),
        }))
        .filter((group) => group.stories.length > 0),
    [deletedStoryIds, groups],
  );

  const currentGroup = availableGroups[groupIndex];
  const currentStory = currentGroup?.stories[storyIndex];
  const isOwner = currentGroup
    ? getUserId(currentGroup.user) === currentUserId
    : false;

  const [isViewerListOpen, setIsViewerListOpen] = useState(false);

  const SUPPORTED_REACTIONS = ["❤️", "😂", "😮", "😢", "🔥", "👍"];

  // Map of storyId -> reaction response; updated only in mutation callbacks (never in effects)
  const [reactionOverrides, setReactionOverrides] = useState({});

  const computeReactions = (storyId, raw, userId) => {
    const counts = SUPPORTED_REACTIONS.reduce((acc, type) => {
      const count = raw.filter((r) => r.type === type).length;
      if (count > 0) acc.push({ type, count });
      return acc;
    }, []);
    const myReaction =
      raw.find((r) => {
        const uid =
          typeof r.user === "string" ? r.user : r.user?._id || r.user?.id || "";
        return uid === userId;
      })?.type || null;
    return { storyId, reactions: counts, myReaction };
  };

  const currentReactions =
    reactionOverrides[currentStory?._id] ??
    computeReactions(
      currentStory?._id,
      currentStory?.reactions || [],
      currentUserId,
    );

  const { mutate: reactToStory, isPending: isReacting } = useMutation({
    mutationFn: ({ storyId, type }) => addStoryReaction(storyId, type),
    onSuccess: (data) => {
      setReactionOverrides((prev) => ({ ...prev, [data.storyId]: data }));
    },
    onError: (error) => {
      setViewerError(
        error.response?.data?.message ||
          "Unable to add reaction. Please try again.",
      );
    },
  });

  const { mutate: unreactToStory, isPending: isUnreacting } = useMutation({
    mutationFn: (storyId) => removeStoryReaction(storyId),
    onSuccess: (data) => {
      setReactionOverrides((prev) => ({ ...prev, [data.storyId]: data }));
    },
    onError: (error) => {
      setViewerError(
        error.response?.data?.message ||
          "Unable to remove reaction. Please try again.",
      );
    },
  });

  const handleReaction = (type) => {
    if (!currentStory?._id || isReacting || isUnreacting) return;
    if (currentReactions.myReaction === type) {
      unreactToStory(currentStory._id);
    } else {
      reactToStory({ storyId: currentStory._id, type });
    }
  };

  const {
    data: viewers = [],
    isLoading: isLoadingViewers,
    isError: isErrorViewers,
  } = useQuery({
    queryKey: ["storyViewers", currentStory?._id],
    queryFn: () => getStoryViewers(currentStory._id),
    enabled: Boolean(isOwner && isViewerListOpen && currentStory?._id),
    retry: false,
  });

  const closeViewer = useCallback(() => {
    onClose();
  }, [onClose]);

  const moveToNext = useCallback(() => {
    setIsViewerListOpen(false);
    if (!currentGroup) {
      closeViewer();
      return;
    }

    let nextStoryIndex = storyIndex + 1;
    while (
      nextStoryIndex < currentGroup.stories.length &&
      unavailableStoryIds.current.has(currentGroup.stories[nextStoryIndex]._id)
    ) {
      nextStoryIndex += 1;
    }

    if (nextStoryIndex < currentGroup.stories.length) {
      resetPlayback();
      setStoryIndex(nextStoryIndex);
      return;
    }

    let nextGroupIndex = groupIndex + 1;
    while (
      nextGroupIndex < availableGroups.length &&
      availableGroups[nextGroupIndex].stories.every((story) =>
        unavailableStoryIds.current.has(story._id),
      )
    ) {
      nextGroupIndex += 1;
    }

    if (nextGroupIndex < availableGroups.length) {
      resetPlayback();
      setGroupIndex(nextGroupIndex);
      setStoryIndex(0);
      return;
    }

    closeViewer();
  }, [
    availableGroups,
    closeViewer,
    currentGroup,
    groupIndex,
    storyIndex,
    resetPlayback,
  ]);

  const moveToPrevious = useCallback(() => {
    setIsViewerListOpen(false);
    if (!currentGroup) {
      closeViewer();
      return;
    }

    let previousStoryIndex = storyIndex - 1;
    while (
      previousStoryIndex >= 0 &&
      unavailableStoryIds.current.has(
        currentGroup.stories[previousStoryIndex]._id,
      )
    ) {
      previousStoryIndex -= 1;
    }

    if (previousStoryIndex >= 0) {
      resetPlayback();
      setStoryIndex(previousStoryIndex);
      return;
    }

    let previousGroupIndex = groupIndex - 1;
    while (
      previousGroupIndex >= 0 &&
      availableGroups[previousGroupIndex].stories.every((story) =>
        unavailableStoryIds.current.has(story._id),
      )
    ) {
      previousGroupIndex -= 1;
    }

    if (previousGroupIndex >= 0) {
      const previousGroup = availableGroups[previousGroupIndex];
      resetPlayback();
      setGroupIndex(previousGroupIndex);
      setStoryIndex(previousGroup.stories.length - 1);
      return;
    }

    closeViewer();
  }, [
    availableGroups,
    closeViewer,
    currentGroup,
    groupIndex,
    storyIndex,
    resetPlayback,
  ]);

  const { mutate: markViewed } = useMutation({
    mutationFn: viewStory,
    onSuccess: (updatedStory) => {
      onStoryViewed(updatedStory);
    },
    onError: (error, storyId) => {
      if (activeStoryId.current !== storyId) return;

      unavailableStoryIds.current.add(storyId);
      onStoryUnavailable();
      setViewerError(
        error.response?.data?.message || "This Story is no longer available.",
      );
      moveToNext();
    },
  });

  const { mutate: removeStory, isPending: isDeleting } = useMutation({
    mutationFn: deleteStory,
    onSuccess: (_, storyId) => {
      setIsViewerListOpen(false);
      const currentStories = currentGroup?.stories || [];
      const remainingStories = currentStories.filter(
        (story) => story._id !== storyId,
      );
      const nextGroups = availableGroups.filter(
        (group) => getUserId(group.user) !== getUserId(currentGroup?.user),
      );

      setDeletedStoryIds((ids) => new Set(ids).add(storyId));
      onStoryDeleted(storyId);

      if (remainingStories.length > 0) {
        setStoryIndex(Math.min(storyIndex, remainingStories.length - 1));
        resetPlayback();
        return;
      }

      const nextGroup = nextGroups[groupIndex];
      if (nextGroup) {
        setGroupIndex(groupIndex);
        setStoryIndex(0);
        resetPlayback();
        return;
      }

      const previousGroup = nextGroups[groupIndex - 1];
      if (previousGroup) {
        setGroupIndex(groupIndex - 1);
        setStoryIndex(previousGroup.stories.length - 1);
        resetPlayback();
        return;
      }

      closeViewer();
    },
    onError: (error) => {
      setViewerError(
        error.response?.data?.message ||
          "Unable to delete this Story. Please try again.",
      );
    },
  });

  useEffect(() => {
    activeStoryId.current = currentStory?._id || null;
  }, [currentStory?._id]);

  useEffect(() => {
    if (!currentStory?._id || viewedStoryIds.current.has(currentStory._id)) {
      return undefined;
    }

    viewedStoryIds.current.add(currentStory._id);
    markViewed(currentStory._id);
    return undefined;
  }, [currentStory?._id, markViewed]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      // Don't navigate when reply input is focused
      if (document.activeElement === replyInputRef.current) {
        if (event.key === "Escape") {
          replyInputRef.current?.blur();
        }
        return;
      }
      if (event.key === "Escape") {
        if (isViewerListOpen) {
          setIsViewerListOpen(false);
        } else {
          closeViewer();
        }
      }
      if (isViewerListOpen) return;
      if (event.key === "ArrowRight") moveToNext();
      if (event.key === "ArrowLeft") moveToPrevious();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeViewer, moveToNext, moveToPrevious, isViewerListOpen]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setPauseReason("hidden", document.hidden);
    };

    handleVisibilityChange();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [setPauseReason]);

  useEffect(() => {
    setPauseReason("viewer-list", isViewerListOpen);
  }, [isViewerListOpen, setPauseReason]);

  useEffect(() => {
    if (!currentStory?._id || imageLoading || imageError || isPaused) {
      return undefined;
    }

    let animationFrame;
    let previousTime = performance.now();

    const updatePlayback = (time) => {
      playbackElapsed.current += time - previousTime;
      previousTime = time;
      const nextProgress = Math.min(
        100,
        (playbackElapsed.current / STORY_DURATION_MS) * 100,
      );
      setProgress(nextProgress);

      if (nextProgress >= 100) {
        moveToNext();
        return;
      }

      animationFrame = requestAnimationFrame(updatePlayback);
    };

    animationFrame = requestAnimationFrame(updatePlayback);
    return () => cancelAnimationFrame(animationFrame);
  }, [currentStory?._id, imageError, imageLoading, isPaused, moveToNext]);

  const handlePointerDown = () => {
    setPauseReason("pointer", true);
  };

  const handlePointerUp = () => {
    setPauseReason("pointer", false);
  };

  const handleTouchStart = (event) => {
    const touch = event.touches[0];
    touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
    setPauseReason("pointer", true);
  };

  const handleTouchEnd = (event) => {
    const start = touchStart.current;
    const touch = event.changedTouches[0];
    touchStart.current = null;
    setPauseReason("pointer", false);
    if (!start || !touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (
      Math.abs(deltaX) < SWIPE_DISTANCE_PX ||
      Math.abs(deltaX) < Math.abs(deltaY)
    ) {
      return;
    }

    if (deltaX < 0) moveToNext();
    else moveToPrevious();
  };

  const handleSendReply = async () => {
    const trimmed = replyText.trim();
    if (!trimmed || isSendingReply || !chatClient || !currentStory) return;

    const storyOwnerId = getUserId(currentGroup.user);
    if (!storyOwnerId || storyOwnerId === currentUserId) return;

    setIsSendingReply(true);
    setReplyError("");

    try {
      const channelId = buildChatChannelId(currentUserId, storyOwnerId);
      const ch = chatClient.channel("messaging", channelId, {
        members: [currentUserId, storyOwnerId],
      });
      await ch.watch();
      await ch.sendMessage({
        text: trimmed,
        story_id: String(currentStory._id),
        story_owner_id: String(storyOwnerId),
        story_owner_name: ownerName,
        story_media_url: currentStory.mediaUrl,
        story_media_type: currentStory.mediaType,
        story_text: currentStory.text || "",
      });
      setReplyText("");
    } catch (err) {
      setReplyError(
        err?.response?.data?.message ||
          err?.message ||
          "Could not send reply. Please try again.",
      );
    } finally {
      setIsSendingReply(false);
    }
  };

  if (!currentStory || !currentGroup) {
    return null;
  }

  const ownerName = getUserName(currentGroup.user);
  const ownerAvatar = currentGroup.user?.profilePic || currentGroup.user?.image;

  const handleDelete = () => {
    if (!isOwner || isDeleting || !window.confirm("Delete this Story?")) {
      return;
    }

    setViewerError("");
    removeStory(currentStory._id);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`${ownerName}'s Story`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeViewer();
      }}
    >
      <div className="relative flex h-[min(760px,calc(100dvh-1.5rem))] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-base-300 bg-base-100 pb-[env(safe-area-inset-bottom)] shadow-2xl sm:h-[min(760px,calc(100dvh-3rem))]">
        <div className="absolute left-0 right-0 top-0 z-20 flex gap-1 p-3">
          {currentGroup.stories.map((story, index) => (
            <div
              key={story._id}
              className="h-1 flex-1 overflow-hidden rounded-full bg-white/30"
            >
              <div
                className="h-full rounded-full bg-white"
                style={{
                  width:
                    index < storyIndex
                      ? "100%"
                      : index === storyIndex
                        ? `${progress}%`
                        : "0%",
                }}
                role="progressbar"
                aria-label={`Story ${index + 1} progress`}
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={
                  index < storyIndex
                    ? 100
                    : index === storyIndex
                      ? Math.round(progress)
                      : 0
                }
              />
            </div>
          ))}
        </div>

        <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between p-5 pt-7 text-white">
          <button
            type="button"
            onClick={closeViewer}
            className="btn btn-circle btn-sm min-h-11 min-w-11 border-0 bg-black/30 text-white hover:bg-black/50 lg:hidden"
            aria-label="Close Story viewer"
            title="Back"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="flex min-w-0 items-center gap-3">
            <div className="size-10 shrink-0 overflow-hidden rounded-full border-2 border-white/80 bg-base-300">
              {ownerAvatar ? (
                <img
                  src={ownerAvatar}
                  alt={ownerName}
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center font-semibold text-base-content">
                  {ownerName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <p className="truncate font-semibold">{ownerName}</p>
          </div>
          <button
            type="button"
            onClick={closeViewer}
            className="btn btn-circle btn-sm min-h-11 min-w-11 border-0 bg-black/30 text-white hover:bg-black/50"
            aria-label="Close Story viewer"
          >
            <X className="size-5" />
          </button>
        </div>

        {isOwner && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="btn btn-error btn-sm absolute right-5 top-20 z-20 gap-2"
          >
            {isDeleting ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        )}

        <div
          className="relative flex min-h-0 flex-1 items-center justify-center bg-black"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handlePointerUp}
        >
          {isPaused && (
            <span className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
              Paused
            </span>
          )}
          {imageLoading && !imageError && (
            <span className="loading loading-spinner loading-lg text-white" />
          )}
          {imageError ? (
            <div className="flex flex-col items-center gap-3 px-8 text-center text-white">
              <ImageOff className="size-10 opacity-70" />
              <p>Unable to load this Story.</p>
              <button type="button" className="btn btn-sm" onClick={moveToNext}>
                Next Story
              </button>
            </div>
          ) : (
            <img
              src={currentStory.mediaUrl}
              alt={`${ownerName}'s Story`}
              className={`max-h-full max-w-full object-contain transition-opacity ${
                imageLoading ? "opacity-0" : "opacity-100"
              }`}
              onLoad={() => setImageLoading(false)}
              onError={() => {
                if (activeStoryId.current !== currentStory._id) return;

                unavailableStoryIds.current.add(currentStory._id);
                onStoryUnavailable();
                setImageLoading(false);
                setImageError(true);
                moveToNext();
              }}
            />
          )}

          <button
            type="button"
            onClick={moveToPrevious}
            className="btn btn-circle btn-sm min-h-11 min-w-11 absolute left-3 top-1/2 border-0 bg-black/30 text-white hover:bg-black/50 sm:left-5"
            aria-label="Previous Story"
          >
            <ArrowLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={moveToNext}
            className="btn btn-circle btn-sm min-h-11 min-w-11 absolute right-3 top-1/2 border-0 bg-black/30 text-white hover:bg-black/50 sm:right-5"
            aria-label="Next Story"
          >
            <ArrowRight className="size-5" />
          </button>
        </div>

        <div className="flex flex-col bg-base-100">
          {/* Reaction picker */}
          {!isOwner && (
            <div className="flex items-center justify-center gap-1 px-3 pt-2 pb-1 flex-wrap">
              {SUPPORTED_REACTIONS.map((emoji) => {
                const isActive = currentReactions.myReaction === emoji;
                const count =
                  currentReactions.reactions.find((r) => r.type === emoji)
                    ?.count || 0;
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleReaction(emoji)}
                    disabled={isReacting || isUnreacting}
                    aria-label={`React with ${emoji}`}
                    aria-pressed={isActive}
                    className={`flex items-center gap-0.5 rounded-full px-2 py-1 text-sm transition-all select-none
                      ${
                        isActive
                          ? "bg-primary/20 ring-2 ring-primary scale-110"
                          : "hover:bg-base-200 active:scale-95"
                      } ${isReacting || isUnreacting ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <span>{emoji}</span>
                    {count > 0 && (
                      <span className="text-[10px] font-semibold opacity-70">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Reaction summary for owner */}
          {isOwner && currentReactions.reactions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 px-4 pt-2 text-xs">
              {currentReactions.reactions.map((r) => (
                <span
                  key={r.type}
                  className="flex items-center gap-0.5 opacity-70"
                >
                  <span>{r.type}</span>
                  <span className="font-semibold">{r.count}</span>
                </span>
              ))}
            </div>
          )}

          {/* Reply composer — non-owners only */}
          {!isOwner && chatClient && (
            <div className="flex items-center gap-2 border-t border-base-300 px-3 py-2">
              <textarea
                ref={replyInputRef}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onFocus={() => setPauseReason("reply-input", true)}
                onBlur={() => setPauseReason("reply-input", false)}
                placeholder="Reply to story..."
                disabled={isSendingReply}
                rows={1}
                className="textarea textarea-sm max-h-32 min-h-11 flex-1 resize-none overflow-y-auto rounded-2xl border-base-300 bg-base-200 py-2 text-sm focus:border-primary focus:outline-none"
                aria-label="Reply to story"
                aria-multiline="true"
              />
              <button
                type="button"
                onClick={handleSendReply}
                disabled={isSendingReply || !replyText.trim()}
                className="btn btn-primary btn-sm min-h-11 rounded-full px-4 disabled:opacity-50"
                aria-label="Send reply"
              >
                {isSendingReply ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  "Send"
                )}
              </button>
            </div>
          )}

          {/* Reply error */}
          {!isOwner && replyError && (
            <p className="px-4 pb-1 text-[11px] text-error">{replyError}</p>
          )}

          {/* Bottom info bar */}
          <div className="flex items-center justify-between gap-3 px-4 py-2 text-xs opacity-70">
            <span>
              Story {storyIndex + 1} of {currentGroup.stories.length}
            </span>
            {isOwner ? (
              <button
                type="button"
                className="flex items-center gap-1.5 hover:text-primary transition font-medium"
                onClick={() => setIsViewerListOpen(true)}
              >
                <Eye className="size-4" />
                <span>{currentStory.viewers?.length || 0} views</span>
              </button>
            ) : (
              <span>{viewerError || "Use arrows or keyboard to navigate"}</span>
            )}
          </div>
        </div>

        {isViewerListOpen && (
          <div className="absolute inset-0 z-30 flex flex-col bg-base-100 p-5 rounded-2xl">
            <div className="flex items-center justify-between border-b border-base-300 pb-3 mb-4 text-base-content">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Eye className="size-5 text-primary" /> Viewers (
                {currentStory.viewers?.length || 0})
              </h3>
              <button
                type="button"
                className="btn btn-ghost btn-circle btn-sm text-base-content"
                onClick={() => setIsViewerListOpen(false)}
                aria-label="Close viewers list"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-base-content">
              {isLoadingViewers ? (
                <div className="flex h-full items-center justify-center">
                  <span className="loading loading-spinner loading-md text-primary" />
                </div>
              ) : isErrorViewers ? (
                <div className="flex h-full items-center justify-center text-error text-sm">
                  Unable to load viewer details.
                </div>
              ) : viewers.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 opacity-50">
                  <Eye className="size-8" />
                  <p className="text-sm">No views yet</p>
                </div>
              ) : (
                viewers.map((viewer) => (
                  <div
                    key={viewer._id || viewer.id}
                    className="flex items-center gap-3 p-2 hover:bg-base-200/50 rounded-xl transition"
                  >
                    <div className="avatar size-10 shrink-0">
                      <div className="rounded-full bg-base-300 overflow-hidden size-full">
                        {viewer.profilePic ? (
                          <img
                            src={viewer.profilePic}
                            alt={viewer.fullName}
                            className="object-cover size-full"
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center font-semibold bg-primary/10 text-primary">
                            {viewer.fullName
                              ? viewer.fullName.charAt(0).toUpperCase()
                              : "?"}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {viewer.fullName}
                      </p>
                      {(viewer.nativeLanguage || viewer.learningLanguage) && (
                        <div className="flex flex-wrap gap-1.5 mt-1 scale-90 origin-left">
                          {viewer.nativeLanguage && (
                            <span className="badge badge-secondary badge-outline text-[10px] py-2">
                              {getLanguageFlag(viewer.nativeLanguage)}{" "}
                              {viewer.nativeLanguage}
                            </span>
                          )}
                          {viewer.learningLanguage && (
                            <span className="badge badge-accent badge-outline text-[10px] py-2">
                              {getLanguageFlag(viewer.learningLanguage)}{" "}
                              {viewer.learningLanguage}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StoryViewer;
