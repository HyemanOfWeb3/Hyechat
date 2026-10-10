const SOCIAL_HOSTS = {
  x: new Set(["x.com", "www.x.com", "twitter.com", "www.twitter.com"]),
  instagram: new Set(["instagram.com", "www.instagram.com", "instagr.am"]),
  facebook: new Set([
    "facebook.com",
    "www.facebook.com",
    "fb.com",
    "www.fb.com",
    "m.facebook.com",
  ]),
  tiktok: new Set(["tiktok.com", "www.tiktok.com"]),
};

const HANDLE_REGEX = {
  x: /^[A-Za-z0-9_]{1,15}$/,
  instagram: /^[A-Za-z0-9_.]{1,30}$/,
  facebook: /^[A-Za-z0-9_.]{1,50}$/,
  tiktok: /^[A-Za-z0-9_.-]{1,24}$/,
};

const RESERVED_HANDLES = {
  x: new Set(["home", "explore", "messages", "notifications", "i"]),
  instagram: new Set(["explore", "reels", "direct", "accounts", "p"]),
  facebook: new Set(["watch", "groups", "pages", "marketplace", "gaming"]),
  tiktok: new Set(["discover", "live", "tag", "music"]),
};

const normalizePlatformHandle = (platform, value) => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("@")) {
    const handle = trimmed.slice(1).trim();
    if (!HANDLE_REGEX[platform]?.test(handle)) return null;
    if (RESERVED_HANDLES[platform]?.has(handle.toLowerCase())) return null;
    return platform === "tiktok" ? `https://tiktok.com/@${handle}` : `https://${platform === "x" ? "x.com" : platform === "instagram" ? "instagram.com" : platform === "facebook" ? "facebook.com" : "tiktok.com"}/${handle}`;
  }

  if (
    !trimmed.includes("/") &&
    !trimmed.includes(":") &&
    !/\.(com|org|net|io|me|app)$/i.test(trimmed) &&
    HANDLE_REGEX[platform]?.test(trimmed)
  ) {
    const handle = trimmed;
    if (RESERVED_HANDLES[platform]?.has(handle.toLowerCase())) return null;
    if (platform === "tiktok") return `https://tiktok.com/@${handle}`;
    if (platform === "x") return `https://x.com/${handle}`;
    if (platform === "instagram") return `https://instagram.com/${handle}`;
    if (platform === "facebook") return `https://facebook.com/${handle}`;
  }

  let parsedUrl;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    parsedUrl = new URL(withProtocol);
  } catch {
    return null;
  }

  if (parsedUrl.protocol !== "https:") {
    return null;
  }

  if (parsedUrl.username || parsedUrl.password) {
    return null;
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const isAllowedHostname = [...SOCIAL_HOSTS[platform]].some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );
  if (!isAllowedHostname || parsedUrl.username || parsedUrl.password) {
    return null;
  }

  const pathname = parsedUrl.pathname.replace(/\/+$/, "");
  if (!pathname || pathname === "/" || pathname === "/@") return null;

  const parts = pathname.split("/").filter(Boolean);
  let handle = "";

  switch (platform) {
    case "x": {
      handle = parts[0]?.replace(/^@/, "") || "";
      if (!handle || !HANDLE_REGEX.x.test(handle)) return null;
      if (RESERVED_HANDLES.x.has(handle.toLowerCase())) return null;
      return `https://x.com/${handle}`;
    }
    case "instagram": {
      handle = parts[0]?.replace(/^@/, "") || "";
      if (!handle || !HANDLE_REGEX.instagram.test(handle)) return null;
      if (RESERVED_HANDLES.instagram.has(handle.toLowerCase())) return null;
      return `https://instagram.com/${handle}`;
    }
    case "facebook": {
      if (pathname.includes("profile.php") && parsedUrl.searchParams.has("id")) {
        const id = parsedUrl.searchParams.get("id");
        return `https://facebook.com/profile.php?id=${encodeURIComponent(id)}`;
      }
      handle = parts[0]?.replace(/^@/, "") || "";
      if (!handle || !HANDLE_REGEX.facebook.test(handle)) return null;
      if (RESERVED_HANDLES.facebook.has(handle.toLowerCase())) return null;
      return `https://facebook.com/${handle}`;
    }
    case "tiktok": {
      handle = parts[0]?.replace(/^@/, "") || "";
      if (!handle || !HANDLE_REGEX.tiktok.test(handle)) return null;
      if (RESERVED_HANDLES.tiktok.has(handle.toLowerCase())) return null;
      return `https://tiktok.com/@${handle}`;
    }
    default:
      return null;
  }
};

export const getSafeSocialLinks = (socialLinks) => {
  if (
    !socialLinks ||
    typeof socialLinks !== "object" ||
    Array.isArray(socialLinks)
  ) {
    return [];
  }

  return Object.entries(socialLinks).flatMap(([platform, value]) => {
    if (
      !Object.hasOwn(SOCIAL_HOSTS, platform) ||
      typeof value !== "string" ||
      !value.trim() ||
      value.length > 2048
    ) {
      return [];
    }

    const normalized = normalizePlatformHandle(platform, value);
    if (!normalized) return [];

    return [[platform, normalized]];
  });
};
