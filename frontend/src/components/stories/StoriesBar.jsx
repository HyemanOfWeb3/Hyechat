import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus } from "lucide-react";
import { createStory, getStories } from "../../lib/api.js";
import useAuthUser from "../../hooks/useAuthUser.js";
import StoryViewer from "./StoryViewer.jsx";

const MAX_STORY_SIZE = 10 * 1024 * 1024;

const getUserId = (user) => {
  if (!user) return "";
  return typeof user === "string" ? user : user._id || user.id || "";
};

const getUserName = (user, fallback = "User") => {
  if (!user || typeof user === "string") return fallback;
  return user.fullName || user.name || fallback;
};

const getFirstUnviewedStoryIndex = (stories, currentUserId) => {
  const firstUnviewedIndex = stories.findIndex(
    (story) =>
      !(story.viewers || []).some(
        (viewer) => getUserId(viewer) === currentUserId,
      ),
  );

  return firstUnviewedIndex >= 0 ? firstUnviewedIndex : 0;
};

const StoriesBar = ({ chatClient }) => {
  const { authUser } = useAuthUser();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [viewerGroupIndex, setViewerGroupIndex] = useState(null);

  const {
    data: storyResponse = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["stories"],
    queryFn: getStories,
    enabled: !!authUser,
    retry: false,
  });

  const stories = useMemo(
    () =>
      (Array.isArray(storyResponse) ? storyResponse : []).filter(
        (story) => !story.expiresAt || new Date(story.expiresAt) > new Date(),
      ),
    [storyResponse],
  );
  const groupedStories = useMemo(() => {
    const groups = new Map();

    stories.forEach((story) => {
      const userId = getUserId(story.user);
      if (!userId) return;

      if (!groups.has(userId)) {
        groups.set(userId, {
          user: story.user,
          stories: [],
        });
      }
      groups.get(userId).stories.push(story);
    });

    return Array.from(groups.values());
  }, [stories]);

  const currentUserId = getUserId(authUser);
  const ownGroup = groupedStories.find(
    (group) => getUserId(group.user) === currentUserId,
  );
  const friendGroups = groupedStories.filter(
    (group) => getUserId(group.user) !== currentUserId,
  );
  const viewerGroups = ownGroup ? [ownGroup, ...friendGroups] : friendGroups;

  const updateStoryInCache = (updatedStory) => {
    queryClient.setQueryData(["stories"], (currentStories = []) =>
      currentStories.map((story) =>
        story._id === updatedStory._id
          ? {
              ...story,
              ...updatedStory,
              user:
                typeof updatedStory.user === "object"
                  ? updatedStory.user
                  : story.user,
            }
          : story,
      ),
    );
  };

  const handleStoryUnavailable = () => {
    queryClient.invalidateQueries({ queryKey: ["stories"] });
  };

  const removeStoryFromCache = (storyId) => {
    queryClient.setQueryData(["stories"], (currentStories = []) =>
      currentStories.filter((story) => story._id !== storyId),
    );
  };

  const getLatestStory = (group) => {
    if (!group?.stories?.length) return null;

    return group.stories.reduce((latest, story) => {
      if (!latest) return story;
      return new Date(story.createdAt || story.created_at || 0) >
        new Date(latest.createdAt || latest.created_at || 0)
        ? story
        : latest;
    }, null);
  };

  const { mutate: createStoryMutation, isPending } = useMutation({
    mutationFn: async (file) => {
      if (!chatClient)
        throw new Error("Chat is still loading. Please try again.");

      const isVideo = file.type.startsWith("video/");
      const uploadResponse = await chatClient.uploadFile(
        file,
        file.name,
        file.type,
      );

      if (!uploadResponse?.file) {
        throw new Error(
          `Stream did not return a ${isVideo ? "video" : "image"} URL`,
        );
      }

      return createStory(uploadResponse.file, isVideo ? "video" : "image");
    },
    onSuccess: async () => {
      setErrorMessage("");
      setSuccessMessage("Your Story is live for 24 hours.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await queryClient.invalidateQueries({ queryKey: ["stories"] });
    },
    onError: (error) => {
      setSuccessMessage("");
      setErrorMessage(
        error.response?.data?.message ||
          error.message ||
          "Unable to create your Story. Please try again.",
      );
    },
  });

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    setErrorMessage("");
    setSuccessMessage("");

    if (!file) return;
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setErrorMessage("Please select an image or video file.");
      return;
    }
    if (file.size > MAX_STORY_SIZE) {
      setErrorMessage("Stories must be smaller than 10 MB.");
      return;
    }

    createStoryMutation(file);
  };

  const ownAvatar = authUser?.profilePic;
  const latestOwnStory = getLatestStory(ownGroup);
  const ownStoryImage = latestOwnStory?.mediaUrl || ownAvatar;

  const openStoryGroup = (group) => {
    const groupIndex = viewerGroups.indexOf(group);
    if (groupIndex < 0) return;

    setViewerGroupIndex(groupIndex);
  };

  return (
    <div className="rounded-xl border border-base-300 bg-base-200/50 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Stories</h2>
          <p className="text-xs opacity-60">Share a moment with your friends</p>
        </div>
        {isLoading && (
          <span className="loading loading-spinner loading-sm text-primary" />
        )}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-1">
        <div className="flex w-16 shrink-0 flex-col items-center gap-2 text-center">
          <div
            className={`relative size-14 rounded-full p-0.5 ${
              ownGroup
                ? ownGroup.stories.some((story) =>
                    (story.viewers || []).some(
                      (viewer) => getUserId(viewer) === currentUserId,
                    ),
                  )
                  ? "bg-base-300"
                  : "bg-primary"
                : "border-2 border-dashed border-primary/60"
            }`}
          >
            {ownGroup ? (
              <button
                type="button"
                className="size-full overflow-hidden rounded-full bg-base-300"
                onClick={() => openStoryGroup(ownGroup)}
                title="View your Story"
              >
                {ownStoryImage || ownAvatar ? (
                  <img
                    src={ownStoryImage || ownAvatar}
                    alt={getUserName(authUser, "Your Story")}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-lg font-semibold opacity-70">
                    {getUserName(authUser, "You").charAt(0).toUpperCase()}
                  </div>
                )}
              </button>
            ) : (
              <label className="block size-full cursor-pointer overflow-hidden rounded-full bg-base-300">
                {ownStoryImage ? (
                  <img
                    src={ownStoryImage}
                    alt={getUserName(authUser, "Your Story")}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-lg font-semibold opacity-70">
                    {getUserName(authUser, "You").charAt(0).toUpperCase()}
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isPending || !chatClient}
                />
              </label>
            )}
            {!ownGroup && (
              <span className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full border-2 border-base-200 bg-primary text-primary-content">
                <ImagePlus className="size-3.5" />
              </span>
            )}
          </div>
          <span className="w-full truncate text-xs font-medium">
            Your Story
          </span>
          {ownGroup && (
            <label className="cursor-pointer text-[10px] text-primary hover:underline">
              Add another
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileChange}
                className="hidden"
                disabled={isPending || !chatClient}
              />
            </label>
          )}
        </div>

        {friendGroups.map((group) => {
          const user = group.user;
          const name = getUserName(user);
          const avatar = user?.profilePic || user?.image;
          const latestStory = getLatestStory(group);
          const latestStoryMedia = latestStory?.mediaUrl || avatar;
          return (
            <button
              key={getUserId(user)}
              type="button"
              onClick={() => openStoryGroup(group)}
              className={`flex w-16 shrink-0 flex-col items-center gap-2 text-center opacity-90 ${
                group.stories.some(
                  (story) =>
                    !(story.viewers || []).some(
                      (viewer) => getUserId(viewer) === currentUserId,
                    ),
                )
                  ? ""
                  : "opacity-60"
              }`}
              title={`View ${name}'s Story`}
            >
              <div
                className={`size-14 rounded-full p-0.5 ${
                  group.stories.some(
                    (story) =>
                      !(story.viewers || []).some(
                        (viewer) => getUserId(viewer) === currentUserId,
                      ),
                  )
                    ? "bg-primary"
                    : "bg-base-300"
                }`}
              >
                <div className="size-full overflow-hidden rounded-full bg-base-300">
                  {latestStoryMedia ? (
                    <img
                      src={latestStoryMedia}
                      alt={name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-lg font-semibold opacity-70">
                      {name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
              <span className="w-full truncate text-xs">{name}</span>
            </button>
          );
        })}
      </div>

      {isPending && (
        <p className="mt-3 text-sm opacity-70">
          Uploading and creating Story...
        </p>
      )}
      {errorMessage && (
        <p className="mt-3 text-sm text-error">{errorMessage}</p>
      )}
      {successMessage && (
        <p className="mt-3 text-sm text-success">{successMessage}</p>
      )}
      {isError && !errorMessage && (
        <p className="mt-3 text-sm text-error">
          Unable to load Stories right now.
        </p>
      )}

      {viewerGroupIndex !== null && viewerGroups[viewerGroupIndex] && (
        <StoryViewer
          groups={viewerGroups}
          initialGroupIndex={viewerGroupIndex}
          initialStoryIndex={getFirstUnviewedStoryIndex(
            viewerGroups[viewerGroupIndex].stories,
            currentUserId,
          )}
          currentUserId={currentUserId}
          chatClient={chatClient}
          onStoryViewed={updateStoryInCache}
          onStoryDeleted={removeStoryFromCache}
          onStoryUnavailable={handleStoryUnavailable}
          onClose={() => setViewerGroupIndex(null)}
        />
      )}
    </div>
  );
};

export default StoriesBar;
