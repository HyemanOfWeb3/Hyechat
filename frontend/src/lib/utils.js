export const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

export const buildChatChannelId = (userA, userB) => {
  const base = [String(userA), String(userB)].sort().join("-");
  const safeBase = base.replace(/[^a-zA-Z0-9_-]/g, "");

  if (!safeBase) return "chat";
  if (safeBase.length <= 64) return safeBase;

  let hash = 0;
  for (let i = 0; i < base.length; i += 1) {
    hash = (hash << 5) - hash + base.charCodeAt(i);
    hash |= 0;
  }

  const shortHash = Math.abs(hash).toString(16).slice(0, 8);
  return `${safeBase.slice(0, 55)}-${shortHash}`;
};
