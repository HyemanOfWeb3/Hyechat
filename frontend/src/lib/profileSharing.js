export const buildProfileShareDetails = (profile, origin) => {
  const profileUrl = new URL(
    `/profile/${encodeURIComponent(profile._id)}`,
    origin,
  ).href;
  const summary = profile.bio?.trim()
    ? profile.bio.trim().slice(0, 120)
    : "Connect and learn languages with me on HyeChat.";

  return {
    canonicalUrl: profileUrl,
    shareData: {
      title: `${profile.fullName} on HyeChat`,
      text: `${profile.fullName} on HyeChat\n${summary}\n\nView my profile:`,
      url: profileUrl,
    },
  };
};

export const shareProfileOrCopy = async ({ share, copy, shareData }) => {
  if (typeof share !== "function") {
    await copy();
    return "copied";
  }

  try {
    await share(shareData);
    return "shared";
  } catch (error) {
    if (error?.name === "AbortError") return "cancelled";
    await copy();
    return "copied";
  }
};
