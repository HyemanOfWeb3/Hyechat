/**
 * Validation and normalization for user social media links.
 * Supported platforms: X, Instagram, Facebook, TikTok.
 */

const PLATFORM_DOMAINS = {
  x: ["x.com", "www.x.com", "twitter.com", "www.twitter.com"],
  instagram: ["instagram.com", "www.instagram.com", "instagr.am"],
  facebook: [
    "facebook.com",
    "www.facebook.com",
    "fb.com",
    "www.fb.com",
    "m.facebook.com",
  ],
  tiktok: ["tiktok.com", "www.tiktok.com"],
};

const HANDLE_REGEX = {
  x: /^[A-Za-z0-9_]{1,15}$/,
  instagram: /^[A-Za-z0-9_.]{1,30}$/,
  facebook: /^[A-Za-z0-9_.]{1,50}$/,
  tiktok: /^[A-Za-z0-9_.-]{1,24}$/,
};

/**
 * Normalizes input for a given platform into a canonical HTTPS URL.
 * Accepts either `@username`, raw `username`, or a full valid URL.
 * Returns null if the value is empty.
 * Throws an Error with a user-friendly message if invalid.
 */
export function normalizeSocialLink(platform, input) {
  if (!input || typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw) return null;

  const validPlatforms = ["x", "instagram", "facebook", "tiktok"];
  if (!validPlatforms.includes(platform)) {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  // Handle @handle or raw username
  if (raw.startsWith("@")) {
    const cleanHandle = raw.slice(1).trim();
    if (HANDLE_REGEX[platform].test(cleanHandle)) {
      switch (platform) {
        case "x":
          return `https://x.com/${cleanHandle}`;
        case "instagram":
          return `https://instagram.com/${cleanHandle}`;
        case "facebook":
          return `https://facebook.com/${cleanHandle}`;
        case "tiktok":
          return `https://tiktok.com/@${cleanHandle}`;
      }
    }
  }

  // If plain username without slashes, protocol or standard web domains
  if (
    !raw.includes("/") &&
    !raw.includes(":") &&
    !/\.(com|org|net|io|me|app)$/i.test(raw) &&
    HANDLE_REGEX[platform].test(raw)
  ) {
    switch (platform) {
      case "x":
        return `https://x.com/${raw}`;
      case "instagram":
        return `https://instagram.com/${raw}`;
      case "facebook":
        return `https://facebook.com/${raw}`;
      case "tiktok":
        return `https://tiktok.com/@${raw}`;
    }
  }

  // Parse as URL
  let parsedUrl;
  try {
    // If user forgot protocol e.g. "x.com/username"
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    parsedUrl = new URL(withProtocol);
  } catch {
    throw new Error(
      `Enter a valid ${platformLabel(platform)} profile URL or username.`,
    );
  }

  // Protocol check - only allow HTTPS or HTTP upgraded to HTTPS
  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    throw new Error(`Invalid URL protocol for ${platformLabel(platform)}.`);
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const allowedDomains = PLATFORM_DOMAINS[platform];
  const isDomainAllowed = allowedDomains.includes(hostname);

  if (!isDomainAllowed) {
    throw new Error(
      `Please provide a legitimate ${platformLabel(platform)} profile link.`,
    );
  }

  // Clean pathname
  let pathname = parsedUrl.pathname.replace(/\/+$/, ""); // remove trailing slashes
  if (!pathname || pathname === "/" || pathname === "/@") {
    throw new Error(
      `Please specify a username or profile path for ${platformLabel(platform)}.`,
    );
  }

  switch (platform) {
    case "x": {
      // twitter.com/username or x.com/username
      const parts = pathname.split("/").filter(Boolean);
      const handle = parts[0]?.replace(/^@/, "");
      if (
        !handle ||
        !HANDLE_REGEX.x.test(handle) ||
        ["home", "explore", "messages", "notifications", "i"].includes(
          handle.toLowerCase(),
        )
      ) {
        throw new Error(
          "Enter a valid X profile (e.g. @username or https://x.com/username).",
        );
      }
      return `https://x.com/${handle}`;
    }
    case "instagram": {
      // instagram.com/username
      const parts = pathname.split("/").filter(Boolean);
      const handle = parts[0]?.replace(/^@/, "");
      if (
        !handle ||
        !HANDLE_REGEX.instagram.test(handle) ||
        ["explore", "reels", "direct", "accounts", "p"].includes(
          handle.toLowerCase(),
        )
      ) {
        throw new Error(
          "Enter a valid Instagram profile (e.g. @username or https://instagram.com/username).",
        );
      }
      return `https://instagram.com/${handle}`;
    }
    case "facebook": {
      // facebook.com/username or facebook.com/profile.php?id=...
      if (
        pathname.includes("profile.php") &&
        parsedUrl.searchParams.has("id")
      ) {
        const id = parsedUrl.searchParams.get("id");
        return `https://facebook.com/profile.php?id=${encodeURIComponent(id)}`;
      }
      const parts = pathname.split("/").filter(Boolean);
      const handle = parts[0]?.replace(/^@/, "");
      if (
        !handle ||
        !HANDLE_REGEX.facebook.test(handle) ||
        ["watch", "groups", "pages", "marketplace", "gaming"].includes(
          handle.toLowerCase(),
        )
      ) {
        throw new Error(
          "Enter a valid Facebook profile (e.g. @username or https://facebook.com/username).",
        );
      }
      return `https://facebook.com/${handle}`;
    }
    case "tiktok": {
      // tiktok.com/@username
      const parts = pathname.split("/").filter(Boolean);
      let handle = parts[0];
      if (handle?.startsWith("@")) handle = handle.slice(1);
      if (
        !handle ||
        !HANDLE_REGEX.tiktok.test(handle) ||
        ["discover", "live", "tag", "music"].includes(handle.toLowerCase())
      ) {
        throw new Error(
          "Enter a valid TikTok profile (e.g. @username or https://tiktok.com/@username).",
        );
      }
      return `https://tiktok.com/@${handle}`;
    }
  }

  return `https://${hostname}${pathname}`;
}

export function platformLabel(platform) {
  switch (platform) {
    case "x":
      return "X";
    case "instagram":
      return "Instagram";
    case "facebook":
      return "Facebook";
    case "tiktok":
      return "TikTok";
    default:
      return platform;
  }
}

/**
 * Validates and normalizes an entire socialLinks object.
 */
export function validateAndNormalizeSocialLinks(input, existing = {}) {
  const platforms = ["x", "instagram", "facebook", "tiktok"];
  const base = Object.fromEntries(
    platforms.map((platform) => {
      try {
        return [platform, normalizeSocialLink(platform, existing?.[platform])];
      } catch {
        return [platform, null];
      }
    }),
  );

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return base;
  }

  const result = { ...base };

  for (const platform of platforms) {
    if (Object.prototype.hasOwnProperty.call(input, platform)) {
      const val = input[platform];
      result[platform] = normalizeSocialLink(platform, val);
    }
  }

  return result;
}
