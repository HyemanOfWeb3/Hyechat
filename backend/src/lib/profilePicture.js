export const normalizeOptionalProfilePictureUrl = (value) => {
  if (typeof value !== "string") {
    return { error: "Profile picture must be a valid image URL" };
  }

  const normalized = value.trim();
  if (!normalized) return { value: "" };
  if (normalized.length > 2048) {
    return { error: "Profile picture URL is too long" };
  }

  try {
    const url = new URL(normalized);
    const hostname = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !(hostname === "stream-io-cdn.com" || hostname.endsWith(".stream-io-cdn.com")) ||
      !url.pathname ||
      url.pathname === "/"
    ) {
      return { error: "Profile picture must be a secure Stream image URL" };
    }
    return { value: url.href };
  } catch {
    return { error: "Profile picture must be a valid image URL" };
  }
};
