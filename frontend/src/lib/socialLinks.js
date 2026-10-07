/**
 * Frontend social links validation and normalization.
 * Matches backend validation rules for X, Instagram, Facebook, TikTok.
 */

export const SOCIAL_PLATFORMS = [
  {
    id: "x",
    label: "X",
    placeholder: "@username or https://x.com/username",
    helper: "e.g. @username or https://x.com/username",
    prefix: "https://x.com/",
    colorClass: "hover:text-black dark:hover:text-white",
  },
  {
    id: "instagram",
    label: "Instagram",
    placeholder: "@username or https://instagram.com/username",
    helper: "e.g. @username or https://instagram.com/username",
    prefix: "https://instagram.com/",
    colorClass: "hover:text-pink-600 dark:hover:text-pink-400",
  },
  {
    id: "facebook",
    label: "Facebook",
    placeholder: "@username or https://facebook.com/username",
    helper: "e.g. @username or https://facebook.com/username",
    prefix: "https://facebook.com/",
    colorClass: "hover:text-blue-600 dark:hover:text-blue-400",
  },
  {
    id: "tiktok",
    label: "TikTok",
    placeholder: "@username or https://tiktok.com/@username",
    helper: "e.g. @username or https://tiktok.com/@username",
    prefix: "https://tiktok.com/@",
    colorClass: "hover:text-rose-500 dark:hover:text-rose-400",
  },
];

const PLATFORM_DOMAINS = {
  x: ["x.com", "www.x.com", "twitter.com", "www.twitter.com"],
  instagram: ["instagram.com", "www.instagram.com", "instagr.am"],
  facebook: ["facebook.com", "www.facebook.com", "fb.com", "www.fb.com", "m.facebook.com"],
  tiktok: ["tiktok.com", "www.tiktok.com"],
};

const HANDLE_REGEX = {
  x: /^[A-Za-z0-9_]{1,15}$/,
  instagram: /^[A-Za-z0-9_.]{1,30}$/,
  facebook: /^[A-Za-z0-9_.]{1,50}$/,
  tiktok: /^[A-Za-z0-9_.-]{1,24}$/,
};

export function validateAndNormalizeClientSocialLink(platform, input) {
  if (!input || typeof input !== "string") {
    return { valid: true, error: null, normalizedUrl: null };
  }

  const raw = input.trim();
  if (!raw) {
    return { valid: true, error: null, normalizedUrl: null };
  }

  const platformMeta = SOCIAL_PLATFORMS.find((p) => p.id === platform);
  const platformLabel = platformMeta?.label || platform;

  // Handle simple @username or raw username
  if (raw.startsWith("@")) {
    const cleanHandle = raw.slice(1).trim();
    if (HANDLE_REGEX[platform]?.test(cleanHandle)) {
      switch (platform) {
        case "x":
          return { valid: true, error: null, normalizedUrl: `https://x.com/${cleanHandle}` };
        case "instagram":
          return { valid: true, error: null, normalizedUrl: `https://instagram.com/${cleanHandle}` };
        case "facebook":
          return { valid: true, error: null, normalizedUrl: `https://facebook.com/${cleanHandle}` };
        case "tiktok":
          return { valid: true, error: null, normalizedUrl: `https://tiktok.com/@${cleanHandle}` };
      }
    }
  }

  // If plain username without slashes, protocol or standard web domains
  if (
    !raw.includes("/") &&
    !raw.includes(":") &&
    !/\.(com|org|net|io|me|app)$/i.test(raw) &&
    HANDLE_REGEX[platform]?.test(raw)
  ) {
    switch (platform) {
      case "x":
        return { valid: true, error: null, normalizedUrl: `https://x.com/${raw}` };
      case "instagram":
        return { valid: true, error: null, normalizedUrl: `https://instagram.com/${raw}` };
      case "facebook":
        return { valid: true, error: null, normalizedUrl: `https://facebook.com/${raw}` };
      case "tiktok":
        return { valid: true, error: null, normalizedUrl: `https://tiktok.com/@${raw}` };
    }
  }

  // Parse as URL
  let parsedUrl;
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    parsedUrl = new URL(withProtocol);
  } catch {
    return {
      valid: false,
      error: `Enter a valid ${platformLabel} profile.`,
      normalizedUrl: null,
    };
  }

  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    return {
      valid: false,
      error: `Only HTTPS links are supported for ${platformLabel}.`,
      normalizedUrl: null,
    };
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const allowedDomains = PLATFORM_DOMAINS[platform] || [];
  const isDomainAllowed = allowedDomains.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
  );

  if (!isDomainAllowed) {
    return {
      valid: false,
      error: `Enter a valid ${platformLabel} profile.`,
      normalizedUrl: null,
    };
  }

  const pathname = parsedUrl.pathname.replace(/\/+$/, "");
  if (!pathname || pathname === "/" || pathname === "/@") {
    return {
      valid: false,
      error: `Specify a username for ${platformLabel}.`,
      normalizedUrl: null,
    };
  }

  switch (platform) {
    case "x": {
      const parts = pathname.split("/").filter(Boolean);
      const handle = parts[0]?.replace(/^@/, "");
      if (!handle || !HANDLE_REGEX.x.test(handle) || ["home", "explore", "messages", "notifications", "i"].includes(handle.toLowerCase())) {
        return { valid: false, error: "Enter a valid X profile.", normalizedUrl: null };
      }
      return { valid: true, error: null, normalizedUrl: `https://x.com/${handle}` };
    }
    case "instagram": {
      const parts = pathname.split("/").filter(Boolean);
      const handle = parts[0]?.replace(/^@/, "");
      if (!handle || !HANDLE_REGEX.instagram.test(handle) || ["explore", "reels", "direct", "accounts", "p"].includes(handle.toLowerCase())) {
        return { valid: false, error: "Enter a valid Instagram profile.", normalizedUrl: null };
      }
      return { valid: true, error: null, normalizedUrl: `https://instagram.com/${handle}` };
    }
    case "facebook": {
      if (pathname.includes("profile.php") && parsedUrl.searchParams.has("id")) {
        const id = parsedUrl.searchParams.get("id");
        return { valid: true, error: null, normalizedUrl: `https://facebook.com/profile.php?id=${encodeURIComponent(id)}` };
      }
      const parts = pathname.split("/").filter(Boolean);
      const handle = parts[0]?.replace(/^@/, "");
      if (!handle || !HANDLE_REGEX.facebook.test(handle) || ["watch", "groups", "pages", "marketplace", "gaming"].includes(handle.toLowerCase())) {
        return { valid: false, error: "Enter a valid Facebook profile.", normalizedUrl: null };
      }
      return { valid: true, error: null, normalizedUrl: `https://facebook.com/${handle}` };
    }
    case "tiktok": {
      const parts = pathname.split("/").filter(Boolean);
      let handle = parts[0];
      if (handle?.startsWith("@")) handle = handle.slice(1);
      if (!handle || !HANDLE_REGEX.tiktok.test(handle) || ["discover", "live", "tag", "music"].includes(handle.toLowerCase())) {
        return { valid: false, error: "Enter a valid TikTok profile.", normalizedUrl: null };
      }
      return { valid: true, error: null, normalizedUrl: `https://tiktok.com/@${handle}` };
    }
  }

  return { valid: true, error: null, normalizedUrl: `https://${hostname}${pathname}` };
}
