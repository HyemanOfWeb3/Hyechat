import { CallingState } from "@stream-io/video-client";

const joinPromises = new WeakMap();

export const buildCallUrl = (origin, callId, callType, chatId) => {
  const url = new URL(`/call/${encodeURIComponent(callId)}`, origin);
  url.searchParams.set("type", callType === "voice" ? "voice" : "video");
  if (chatId) url.searchParams.set("chatId", chatId);
  return url.toString();
};

export const getCallChatId = (call) => {
  const value = call?.state?.custom?.hyechat_chat_id;
  return typeof value === "string" && value.trim() ? value : "";
};

export const getIncomingCallType = (event) => {
  const customType = event?.call?.custom?.hyechat_call_type;
  if (customType === "voice" || customType === "video") return customType;
  if (typeof event?.call?.settings?.video?.enabled === "boolean") {
    return event.call.settings.video.enabled ? "video" : "voice";
  }
  if (typeof event?.video === "boolean") return event.video ? "video" : "voice";
  return "video";
};

export const createAndRingChatCall = async ({
  client,
  callId,
  chatId,
  targetUserId,
  callType,
}) => {
  if (!client || !callId || !chatId || !targetUserId) {
    throw new Error("Call details are incomplete. Please try again.");
  }
  if (!["voice", "video"].includes(callType)) {
    throw new Error("Choose a valid call type.");
  }

  const call = client.call("default", callId);
  await call.getOrCreate({
    data: {
      members: [{ user_id: targetUserId }],
      custom: {
        hyechat_chat_id: chatId,
        hyechat_call_type: callType,
      },
    },
    ring: true,
    video: callType === "video",
  });
  return call;
};

export const joinStreamCall = (call) => {
  if (!call || typeof call.join !== "function") {
    return Promise.reject(new Error("Call session is unavailable."));
  }
  if (call.state?.callingState === CallingState.JOINED) {
    return Promise.resolve(call);
  }
  const pending = joinPromises.get(call);
  if (pending) return pending;

  const joinPromise = call
    .join({ create: false })
    .then(() => call)
    .finally(() => joinPromises.delete(call));
  joinPromises.set(call, joinPromise);
  return joinPromise;
};

export const leaveStreamCall = async (call) => {
  if (!call || typeof call.leave !== "function") return false;
  if (call.state?.callingState === CallingState.LEFT) return false;
  await call.leave({ reason: "local" });
  return true;
};

export const getCallJoinErrorMessage = (error, callType = "video") => {
  const name = error?.name || error?.cause?.name;
  const status = error?.status || error?.response?.status || error?.statusCode;
  const message = String(error?.message || "");
  if (
    status === 401 ||
    status === 403 ||
    /(?:token|credential).*(?:expired|invalid)|unauthorized/i.test(message)
  ) {
    return "Your secure call session expired or is unauthorized. Return to chat and try again.";
  }
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return callType === "voice"
      ? "Microphone access was denied. Allow microphone access in your browser settings, then retry."
      : "Camera or microphone access was denied. Allow access in your browser settings, then retry.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return callType === "voice"
      ? "No microphone was found. Connect a microphone and retry."
      : "A camera or microphone was not found. Connect a device and retry.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Your camera or microphone is already in use by another app.";
  }
  return "Unable to join the call. Check your connection and try again.";
};

export const activateCallMedia = async (call, callType) => {
  const errors = [];
  if (!call?.microphone?.enable) {
    return ["Microphone controls are unavailable in this browser."];
  }

  if (callType === "voice" && call.camera?.disable) {
    try {
      await call.camera.disable({ forceStop: true });
    } catch (error) {
      errors.push(getCallJoinErrorMessage(error, callType));
    }
  }

  try {
    await call.microphone.enable();
  } catch (error) {
    errors.push(getCallJoinErrorMessage(error, callType));
  }

  if (callType === "video") {
    if (!call.camera?.enable) {
      errors.push("Camera controls are unavailable in this browser.");
    } else {
      try {
        await call.camera.enable();
      } catch (error) {
        errors.push(getCallJoinErrorMessage(error, callType));
      }
    }
  }

  return [...new Set(errors)];
};

export const getCallConnectionLabel = (callingState, isJoining) => {
  if (isJoining) return "Joining";
  switch (callingState) {
    case CallingState.JOINED:
      return "Connected";
    case CallingState.RECONNECTING:
      return "Reconnecting";
    case CallingState.RECONNECTING_FAILED:
      return "Connection failed";
    case CallingState.OFFLINE:
      return "Offline";
    case CallingState.RINGING:
      return "Ringing";
    default:
      return "Connecting";
  }
};
