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

    try {
      const url = new URL(value);
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        !SOCIAL_HOSTS[platform].has(url.hostname.toLowerCase())
      ) {
        return [];
      }
      return [[platform, url.href]];
    } catch {
      return [];
    }
  });
};
