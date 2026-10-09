export const getStoryViewCount = (story) => {
  if (Number.isFinite(story?.viewCount) && story.viewCount >= 0) {
    return Math.floor(story.viewCount);
  }
  return Array.isArray(story?.viewers) ? story.viewers.length : 0;
};

export const mergeStoryCacheUpdate = (story, updatedStory) => {
  const mergedStory = {
    ...story,
    ...updatedStory,
    user:
      updatedStory.user && typeof updatedStory.user === "object"
        ? updatedStory.user
        : story.user,
    viewedByMe:
      typeof updatedStory.viewedByMe === "boolean"
        ? updatedStory.viewedByMe
        : story.viewedByMe,
    viewCount: getStoryViewCount(
      Number.isFinite(updatedStory.viewCount) ? updatedStory : story,
    ),
    reactions: Array.isArray(updatedStory.reactions)
      ? updatedStory.reactions
      : story.reactions || [],
  };

  delete mergedStory.viewers;
  return mergedStory;
};
