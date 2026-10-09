export const CHAT_SCROLL_BOTTOM_THRESHOLD = 200;

export const getChatScrollStorageKey = (userId, channelCid) =>
  `hyechat:chat-scroll:${encodeURIComponent(userId)}:${encodeURIComponent(channelCid)}`;

export const captureChatScrollPosition = (
  container,
  bottomThreshold = CHAT_SCROLL_BOTTOM_THRESHOLD,
) => {
  if (!container) return null;

  const containerRect = container.getBoundingClientRect();
  const anchor = Array.from(
    container.querySelectorAll("[data-message-id]"),
  ).find(
    (element) => element.getBoundingClientRect().bottom >= containerRect.top,
  );
  const distanceFromBottom = Math.max(
    0,
    container.scrollHeight - container.clientHeight - container.scrollTop,
  );

  return {
    messageId: anchor?.dataset?.messageId || null,
    offsetTop: anchor
      ? anchor.getBoundingClientRect().top - containerRect.top
      : 0,
    distanceFromBottom,
    wasAtBottom: distanceFromBottom <= bottomThreshold,
  };
};

export const restoreChatScrollPosition = (container, snapshot) => {
  if (!container || !snapshot?.messageId || snapshot.wasAtBottom) return false;

  const anchor = Array.from(
    container.querySelectorAll("[data-message-id]"),
  ).find((element) => element.dataset?.messageId === snapshot.messageId);
  if (!anchor) return false;

  const currentOffset =
    anchor.getBoundingClientRect().top - container.getBoundingClientRect().top;
  container.scrollTop += currentOffset - snapshot.offsetTop;
  return true;
};

export const readChatScrollPosition = (storage, key) => {
  try {
    const value = storage?.getItem(key);
    if (!value) return null;
    const parsed = JSON.parse(value);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      (parsed.messageId !== null &&
        (typeof parsed.messageId !== "string" ||
          parsed.messageId.length > 256)) ||
      !Number.isFinite(parsed.offsetTop) ||
      !Number.isFinite(parsed.distanceFromBottom) ||
      typeof parsed.wasAtBottom !== "boolean"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const writeChatScrollPosition = (storage, key, snapshot) => {
  if (!snapshot) return;
  try {
    storage?.setItem(key, JSON.stringify(snapshot));
  } catch {
    // Scroll restoration is best-effort when storage is unavailable.
  }
};
