import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EyeOff, ImagePlus, Play } from "lucide-react";
import {
  createStory,
  getHiddenStoryUsers,
  getStories,
  hideStoriesFromUser,
  unhideStoriesFromUser,
} from "../../lib/api.js";
import useAuthUser from "../../hooks/useAuthUser.js";
import StoryViewer from "./StoryViewer.jsx";
import StoryMediaComposer from "./StoryMediaComposer.jsx";
import VideoTrimEditor from "./VideoTrimEditor.jsx";
import UserAvatar from "../UserAvatar.jsx";
import {
  getStoryViewCount,
  mergeStoryCacheUpdate,
} from "../../lib/storyCache.js";

const MAX_STORY_SIZE = 10 * 1024 * 1024;
const IMAGE_COMPRESSION_THRESHOLD = 1024 * 1024;

const compressStoryImage = async (file) => {
  if (
    !file.type.startsWith("image/") ||
    file.size <= IMAGE_COMPRESSION_THRESHOLD ||
    typeof createImageBitmap !== "function"
  ) {
    return file;
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.84),
    );
    if (!blob || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "story-image";
    return new File([blob], `${baseName}.webp`, {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } catch (error) {
    console.warn("Story image compression failed; using the original", error);
    return file;
  } finally {
    bitmap?.close?.();
  }
};

const getUserId = (user) => {
  if (!user) return "";
  return typeof user === "string" ? user : user._id || user.id || "";
};

const getUserName = (user, fallback = "User") => {
  if (!user || typeof user === "string") return fallback;
  return user.fullName || user.name || fallback;
};

const StoryAvatar = ({ story, userImage, name, userId }) => {
  const [failedStoryImage, setFailedStoryImage] = useState("");
  const showStoryImage =
    story?.mediaType === "image" &&
    story.mediaUrl &&
    story.mediaUrl !== failedStoryImage;

  return (
    <div className="relative size-full overflow-hidden rounded-full bg-base-300">
      {showStoryImage ? (
        <img
          src={story.mediaUrl}
          alt={name}
          className="size-full object-cover"
          onError={() => setFailedStoryImage(story.mediaUrl)}
        />
      ) : (
        <UserAvatar
          src={userImage}
          name={name}
          userId={userId}
          alt=""
          className="size-full text-lg"
          loading="eager"
        />
      )}
      {story?.mediaType === "video" && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/25 text-white">
          <Play className="size-5 fill-current" aria-hidden="true" />
        </span>
      )}
    </div>
  );
};

const hasCurrentUserViewedStory = (story, currentUserId) =>
  typeof story.viewedByMe === "boolean"
    ? story.viewedByMe
    : (story.viewers || []).some(
        (viewer) => getUserId(viewer) === currentUserId,
      );

const getFirstUnviewedStoryIndex = (stories, currentUserId) => {
  const firstUnviewedIndex = stories.findIndex(
    (story) => !hasCurrentUserViewedStory(story, currentUserId),
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
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectionVersion, setSelectionVersion] = useState(0);
  const [originalVideo, setOriginalVideo] = useState(null);
  const [caption, setCaption] = useState("");
  const [prompt, setPrompt] = useState("");
  const [privacy, setPrivacy] = useState("friends");
  const [showHiddenUsers, setShowHiddenUsers] = useState(false);
  const [isTrimmed, setIsTrimmed] = useState(false);
  const [videoToTrim, setVideoToTrim] = useState(null);
  const [isTrimEditorOpen, setIsTrimEditorOpen] = useState(false);

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

  const { data: hiddenStoryUsers = [] } = useQuery({
    queryKey: ["hiddenStoryUsers"],
    queryFn: getHiddenStoryUsers,
    enabled: !!authUser,
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
      currentStories.map((story) => {
        if (story._id !== updatedStory._id) return story;

        return mergeStoryCacheUpdate(story, updatedStory);
      }),
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

  const handleTrimComplete = (trimmedFile) => {
    setIsTrimEditorOpen(false);
    setSelectedFile(trimmedFile);
    setSelectionVersion((version) => version + 1);
    setIsTrimmed(true);
  };

  const handleTrimCancel = () => {
    setIsTrimEditorOpen(false);
  };

  const { mutate: createStoryMutation, isPending } = useMutation({
    mutationFn: async ({
      file,
      text,
      prompt: storyPrompt,
      privacy: storyPrivacy,
    }) => {
      if (!chatClient)
        throw new Error("Chat is still loading. Please try again.");
      if (!file || !file.size)
        throw new Error("Choose a non-empty media file.");
      if (file.size > MAX_STORY_SIZE)
        throw new Error("Stories must be smaller than 10 MB.");

      let uploadFile = file;
      let durationSeconds;
      if (file.type.startsWith("video/")) {
        durationSeconds = await validateVideoDuration(file);
        if (durationSeconds > 60) {
          throw new Error("Trim videos to 60 seconds or less before posting.");
        }
      } else {
        uploadFile = await compressStoryImage(file);
      }

      if (uploadFile.size > MAX_STORY_SIZE) {
        throw new Error("Stories must be 10 MB or smaller after processing.");
      }

      const isVideo = uploadFile.type.startsWith("video/");
      const uploadResponse = await chatClient.uploadFile(
        uploadFile,
        uploadFile.name,
        uploadFile.type,
      );

      if (!uploadResponse?.file) {
        throw new Error(
          `Stream did not return a ${isVideo ? "video" : "image"} URL`,
        );
      }

      try {
        return await createStory(
          uploadResponse.file,
          isVideo ? "video" : "image",
          text,
          {
            prompt: storyPrompt,
            privacy: storyPrivacy,
            mediaSize: uploadFile.size,
            durationSeconds,
          },
        );
      } catch (error) {
        try {
          if (isVideo) await chatClient.deleteFile(uploadResponse.file);
          else await chatClient.deleteImage(uploadResponse.file);
        } catch (cleanupError) {
          console.warn("Could not clean up unlinked Story media", cleanupError);
        }
        throw error;
      }
    },
    onSuccess: async () => {
      setErrorMessage("");
      setSuccessMessage("Your Story is live for 24 hours.");
      setSelectedFile(null);
      setSelectionVersion((version) => version + 1);
      setOriginalVideo(null);
      setVideoToTrim(null);
      setCaption("");
      setPrompt("");
      setPrivacy("friends");
      setIsTrimmed(false);
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

  const { mutate: hideStoriesMutation } = useMutation({
    mutationFn: hideStoriesFromUser,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["stories"] }),
        queryClient.invalidateQueries({ queryKey: ["hiddenStoryUsers"] }),
      ]);
      setViewerGroupIndex(null);
    },
    onError: () => setErrorMessage("Unable to hide these Stories right now."),
  });

  const { mutate: unhideStoriesMutation } = useMutation({
    mutationFn: unhideStoriesFromUser,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["stories"] }),
        queryClient.invalidateQueries({ queryKey: ["hiddenStoryUsers"] }),
      ]);
    },
    onError: () => setErrorMessage("Unable to unhide Stories right now."),
  });

  const validateVideoDuration = (file) => {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      const url = URL.createObjectURL(file);

      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        if (!Number.isFinite(video.duration) || video.duration <= 0) {
          reject(new Error("This video has an invalid duration."));
          return;
        }
        resolve(video.duration);
      };

      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(
          new Error("Unable to load video. Please check the file format."),
        );
      };

      video.src = url;
    });
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    setErrorMessage("");
    setSuccessMessage("");

    if (!file) return;
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setErrorMessage("Please select an image or video file.");
      return;
    }
    if (!file.size) {
      setErrorMessage("The selected file is empty. Choose another file.");
      return;
    }
    if (file.size > MAX_STORY_SIZE) {
      setErrorMessage("Stories must be smaller than 10 MB.");
      return;
    }

    if (file.type.startsWith("video/")) {
      try {
        await validateVideoDuration(file);
      } catch (error) {
        setErrorMessage(error.message);
        return;
      }
      setOriginalVideo(file);
      setVideoToTrim(file);
    } else {
      setOriginalVideo(null);
      setVideoToTrim(null);
    }

    setSelectedFile(file);
    setSelectionVersion((version) => version + 1);
    setCaption("");
    setPrompt("");
    setPrivacy("friends");
    setIsTrimmed(false);
  };

  const openFilePicker = () => fileInputRef.current?.click();
  const cancelComposer = () => {
    if (isPending) return;
    setSelectedFile(null);
    setSelectionVersion((version) => version + 1);
    setOriginalVideo(null);
    setVideoToTrim(null);
    setCaption("");
    setPrompt("");
    setPrivacy("friends");
    setIsTrimmed(false);
    setErrorMessage("");
  };
  const resetTrim = () => {
    if (!originalVideo) return;
    setSelectedFile(originalVideo);
    setSelectionVersion((version) => version + 1);
    setIsTrimmed(false);
  };
  const postStory = () => {
    if (!selectedFile || isPending) return;
    setErrorMessage("");
    createStoryMutation({
      file: selectedFile,
      text: caption,
      prompt,
      privacy,
    });
  };

  const ownAvatar = authUser?.profilePic;
  const latestOwnStory = getLatestStory(ownGroup);

  const openStoryGroup = (group) => {
    const groupIndex = viewerGroups.indexOf(group);
    if (groupIndex < 0) return;

    setViewerGroupIndex(groupIndex);
  };

  return (
    <div className="rounded-xl border border-base-300 bg-base-200/50 p-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileChange}
        className="hidden"
        disabled={isPending || !chatClient}
        aria-label="Select Story image or video"
      />
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
                ? ownGroup.stories.some((story) => getStoryViewCount(story) > 0)
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
                <StoryAvatar
                  story={latestOwnStory}
                  userImage={ownAvatar}
                  name={getUserName(authUser, "You")}
                  userId={getUserId(authUser)}
                />
              </button>
            ) : (
              <button
                type="button"
                onClick={openFilePicker}
                disabled={isPending || !chatClient}
                className="block size-full overflow-hidden rounded-full bg-base-300 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Add a Story"
              >
                <StoryAvatar
                  story={latestOwnStory}
                  userImage={ownAvatar}
                  name={getUserName(authUser, "You")}
                  userId={getUserId(authUser)}
                />
              </button>
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
            <button
              type="button"
              onClick={openFilePicker}
              disabled={isPending || !chatClient}
              className="text-[10px] text-primary hover:underline disabled:opacity-50"
            >
              Add another
            </button>
          )}
        </div>

        {friendGroups.map((group) => {
          const user = group.user;
          const name = getUserName(user);
          const avatar = user?.profilePic || user?.image;
          const latestStory = getLatestStory(group);
          return (
            <button
              key={getUserId(user)}
              type="button"
              onClick={() => openStoryGroup(group)}
              className={`flex w-16 shrink-0 flex-col items-center gap-2 text-center opacity-90 ${
                group.stories.some(
                  (story) => !hasCurrentUserViewedStory(story, currentUserId),
                )
                  ? ""
                  : "opacity-60"
              }`}
              title={`View ${name}'s Story`}
            >
              <div
                className={`size-14 rounded-full p-0.5 ${
                  group.stories.some(
                    (story) => !hasCurrentUserViewedStory(story, currentUserId),
                  )
                    ? "bg-primary"
                    : "bg-base-300"
                }`}
              >
                <div className="size-full overflow-hidden rounded-full bg-base-300">
                  <StoryAvatar
                    story={latestStory}
                    userImage={avatar}
                    name={name}
                    userId={getUserId(user)}
                  />
                </div>
              </div>
              <span className="w-full truncate text-xs">{name}</span>
            </button>
          );
        })}
      </div>

      {errorMessage && !selectedFile && (
        <p className="mt-3 text-sm text-error">{errorMessage}</p>
      )}
      {successMessage && (
        <p className="mt-3 text-sm text-success">{successMessage}</p>
      )}
      {hiddenStoryUsers.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowHiddenUsers((shown) => !shown)}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-xs font-medium text-base-content/70 hover:bg-base-200"
            aria-expanded={showHiddenUsers}
          >
            <EyeOff className="size-4" />
            Hidden Stories ({hiddenStoryUsers.length})
          </button>
          {showHiddenUsers && (
            <div className="mt-2 flex flex-wrap gap-2">
              {hiddenStoryUsers.map((user) => (
                <button
                  key={user._id}
                  type="button"
                  onClick={() => unhideStoriesMutation(user._id)}
                  className="btn btn-outline btn-xs"
                >
                  Unhide {user.fullName || "user"}
                </button>
              ))}
            </div>
          )}
        </div>
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
          onHideStoriesFromUser={(userId) => hideStoriesMutation(userId)}
          onClose={() => setViewerGroupIndex(null)}
        />
      )}

      {selectedFile && (
        <StoryMediaComposer
          key={selectionVersion}
          file={selectedFile}
          caption={caption}
          onCaptionChange={setCaption}
          prompt={prompt}
          onPromptChange={setPrompt}
          privacy={privacy}
          onPrivacyChange={setPrivacy}
          onCancel={cancelComposer}
          onReplace={openFilePicker}
          onResetTrim={resetTrim}
          onTrim={() => setIsTrimEditorOpen(true)}
          onSubmit={postStory}
          isSubmitting={isPending}
          isTrimmed={isTrimmed}
          error={errorMessage}
        />
      )}

      {isTrimEditorOpen && videoToTrim && (
        <VideoTrimEditor
          videoFile={videoToTrim}
          onComplete={handleTrimComplete}
          onCancel={handleTrimCancel}
        />
      )}
    </div>
  );
};

export default StoriesBar;
