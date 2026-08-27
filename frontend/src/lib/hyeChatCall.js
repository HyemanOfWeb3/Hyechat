const CALL_URL_PATTERN = /(?:^|\s)(https?:\/\/[^\s]+|\/call\/[^\s]+)/g;
const HYECHAT_HOSTS = new Set(["hyechat.vercel.app"]);

export const getHyeChatCallDetails = (text) => {
  if (typeof text !== "string") return null;

  const candidates = [...text.matchAll(CALL_URL_PATTERN)];
  for (const match of candidates) {
    const candidate = match[1];
    const cleanCandidate = candidate.replace(/[),.!?]+$/, "");
    let parsedUrl;

    try {
      parsedUrl = new URL(cleanCandidate, window.location.origin);
    } catch {
      continue;
    }

    const isSameOrigin = parsedUrl.origin === window.location.origin;
    const isKnownHyeChatHost = HYECHAT_HOSTS.has(parsedUrl.hostname);
    if (
      (!isSameOrigin && !isKnownHyeChatHost) ||
      !/^\/call\/[^/]+$/.test(parsedUrl.pathname)
    ) {
      continue;
    }

    return {
      url: parsedUrl.href,
      callId: decodeURIComponent(parsedUrl.pathname.slice("/call/".length)),
      callType:
        parsedUrl.searchParams.get("type") === "video" ? "video" : "voice",
    };
  }

  return null;
};
