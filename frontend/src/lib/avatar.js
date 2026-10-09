const LEGACY_PLACEHOLDER_HOSTS = new Set([
  "avatarapi.runflare.run",
  "avatar.iran.liara.run",
  "discovery-course-dev-avatars-placeholder.onrender.com",
]);

const AVATAR_PALETTE = [
  "bg-primary/15 text-primary",
  "bg-secondary/15 text-secondary",
  "bg-accent/15 text-accent",
  "bg-info/15 text-info",
  "bg-success/15 text-success",
  "bg-warning/20 text-warning",
];

export const getAvatarInitials = (name) => {
  const words = String(name || "")
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
  if (!words.length) return "U";

  const initials =
    words.length === 1
      ? Array.from(words[0]).slice(0, 2).join("")
      : `${Array.from(words[0])[0]}${Array.from(words.at(-1))[0]}`;

  return initials.toLocaleUpperCase();
};

export const getAvatarFallbackClassName = (name, userId) => {
  const seed = String(userId || name || "hyechat").toLocaleLowerCase();
  let hash = 0;
  for (const character of seed) {
    hash = (hash * 31 + character.codePointAt(0)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
};

export const getAvatarImageSource = (value) => {
  if (typeof value !== "string" || !value.trim()) return "";
  const source = value.trim();

  try {
    const parsed = new URL(source, "https://hyechat.local");
    if (LEGACY_PLACEHOLDER_HOSTS.has(parsed.hostname.toLowerCase())) return "";
    if (!["https:", "http:", "blob:"].includes(parsed.protocol)) return "";
  } catch {
    return "";
  }

  return source;
};
