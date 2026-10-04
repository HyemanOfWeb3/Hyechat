import { getStreamChannel, getStreamMessage } from "../lib/stream.js";
import { parseBuffer } from "music-metadata";
import {
  getSupportedTranslationLanguages,
  mapProfileLanguageToGoogleCode,
  mapProfileLanguageToSpeechCode,
  TranslationServiceError,
  transcribeAudio,
  translateText,
} from "../services/translation.service.js";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_AUDIO_SECONDS = 60;
const STREAM_CDN_HOST_SUFFIX = "stream-io-cdn.com";
const SUPPORTED_AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp4",
]);

const getMaxAudioDurationSeconds = () => {
  const configuredValue = Number.parseInt(
    process.env.TRANSLATION_MAX_AUDIO_SECONDS || "",
    10,
  );
  return Number.isFinite(configuredValue) && configuredValue > 0
    ? Math.min(configuredValue, 60)
    : Math.min(DEFAULT_MAX_AUDIO_SECONDS, 60);
};

const errorResponse = (res, error) => {
  if (error instanceof TranslationServiceError) {
    return res.status(error.status).json({
      code: error.code,
      message: error.message,
    });
  }

  if (Number(error?.code) === 16 || Number(error?.code) === 7) {
    return res.status(503).json({
      code: "PROVIDER_NOT_CONFIGURED",
      message: "Google Cloud translation is unavailable. Check the server configuration.",
    });
  }

  console.error("Translation request failed");
  return res.status(502).json({
    code: "PROVIDER_FAILURE",
    message: "Translation is temporarily unavailable. Please try again.",
  });
};

const getUserTranslationTarget = async (user, requestedLanguage) => {
  const preference = user.nativeLanguage || user.learningLanguage;
  if (!requestedLanguage && !preference) {
    throw new TranslationServiceError(
      "MISSING_LANGUAGE",
      400,
      "Set your preferred language in your profile before translating.",
    );
  }
  const input = requestedLanguage || (await mapProfileLanguageToGoogleCode(preference));
  if (!input) {
    throw new TranslationServiceError(
      "MISSING_LANGUAGE",
      400,
      "Set your preferred language in your profile before translating.",
    );
  }
  return input;
};

const isAllowedStreamMediaUrl = (value) => {
  if (typeof value !== "string" || !value.trim() || value.length > 2048) {
    return false;
  }
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      (hostname === STREAM_CDN_HOST_SUFFIX ||
        hostname.endsWith(`.${STREAM_CDN_HOST_SUFFIX}`))
    );
  } catch {
    return false;
  }
};

const downloadStreamAudio = async (url, mimeType) => {
  let response;
  try {
    response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new TranslationServiceError(
      "MEDIA_UNAVAILABLE",
      502,
      "Unable to retrieve this voice note from Stream.",
    );
  }

  if (response.status >= 300 && response.status < 400) {
    throw new TranslationServiceError(
      "MEDIA_UNAVAILABLE",
      400,
      "This voice note uses an unsupported media redirect.",
    );
  }
  if (!response.ok) {
    throw new TranslationServiceError(
      "MEDIA_UNAVAILABLE",
      403,
      "This voice note is no longer available to this chat.",
    );
  }

  const responseContentType = (response.headers.get("content-type") || mimeType)
    .split(";")[0]
    .trim()
    .toLowerCase();
  const contentType = SUPPORTED_AUDIO_TYPES.has(responseContentType)
    ? responseContentType
    : mimeType;
  if (!SUPPORTED_AUDIO_TYPES.has(contentType)) {
    throw new TranslationServiceError(
      "UNSUPPORTED_AUDIO_TYPE",
      415,
      "This voice note format cannot be transcribed.",
    );
  }

  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_AUDIO_BYTES) {
    throw new TranslationServiceError(
      "AUDIO_TOO_LARGE",
      413,
      "This voice note is too large to translate.",
    );
  }
  if (!response.body) {
    throw new TranslationServiceError(
      "INVALID_AUDIO",
      400,
      "This voice note contains no audio data.",
    );
  }

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_AUDIO_BYTES) {
      await reader.cancel();
      throw new TranslationServiceError(
        "AUDIO_TOO_LARGE",
        413,
        "This voice note is too large to translate.",
      );
    }
    chunks.push(Buffer.from(value));
  }
  if (!totalBytes) {
    throw new TranslationServiceError(
      "INVALID_AUDIO",
      400,
      "This voice note contains no audio data.",
    );
  }

  return { audio: Buffer.concat(chunks), mimeType: contentType };
};

export async function getTranslationLanguages(req, res) {
  try {
    const languages = await getSupportedTranslationLanguages();
    const preferredLanguageCode = await mapProfileLanguageToGoogleCode(
      req.user.nativeLanguage || req.user.learningLanguage,
    );
    return res.status(200).json({ languages, preferredLanguageCode });
  } catch (error) {
    return errorResponse(res, error);
  }
}

export async function translateTextRequest(req, res) {
  const text = req.body?.text;
  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({
      code: "INVALID_TEXT",
      message: "There is no text to translate.",
    });
  }
  if (text.length > 5000) {
    return res.status(413).json({
      code: "TEXT_TOO_LONG",
      message: "Messages over 5,000 characters cannot be translated.",
    });
  }

  try {
    const targetLanguage = await getUserTranslationTarget(
      req.user,
      req.body?.targetLanguage,
    );
    const result = await translateText(text.trim(), targetLanguage);
    return res.status(200).json({
      translatedText: result.translatedText,
      targetLanguage: result.targetLanguage.code,
      targetLanguageName: result.targetLanguage.name,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}

export async function transcribeVoiceRequest(req, res) {
  const messageId =
    typeof req.body?.messageId === "string" ? req.body.messageId.trim() : "";
  if (!messageId || messageId.length > 256) {
    return res.status(400).json({
      code: "INVALID_MESSAGE",
      message: "This voice message cannot be translated.",
    });
  }

  try {
    if (!req.user.nativeLanguage && !req.user.learningLanguage) {
      throw new TranslationServiceError(
        "SOURCE_LANGUAGE_REQUIRED",
        400,
        "Add a native or learning language to your profile to transcribe voice notes.",
      );
    }
    const message = await getStreamMessage(messageId);
    const [channelType, channelId] = String(message?.cid || "").split(":");
    if (
      !message ||
      !channelId ||
      channelType !== "messaging" ||
      ["system", "deleted", "ephemeral", "error"].includes(message.type) ||
      message.deleted_at
    ) {
      return res.status(404).json({
        code: "MESSAGE_NOT_FOUND",
        message: "This voice note could not be found.",
      });
    }

    const channel = getStreamChannel(channelType, channelId);
    const { members = [] } = await channel.queryMembers({}, [], { limit: 100 });
    if (
      members.length !== 2 ||
      !members.some((member) => String(member.user_id) === String(req.user._id))
    ) {
      return res.status(403).json({
        code: "MEDIA_FORBIDDEN",
        message: "You no longer have access to this chat's voice note.",
      });
    }

    const audioAttachment = (message.attachments || []).find((attachment) => {
      const mimeType = String(attachment?.mime_type || "").toLowerCase();
      return (
        (attachment?.type === "audio" || mimeType.startsWith("audio/")) &&
        (/voice note/i.test(attachment?.title || "") || attachment?.type === "audio")
      );
    });
    const mediaUrl = audioAttachment?.asset_url || audioAttachment?.url;
    const mimeType = String(audioAttachment?.mime_type || "")
      .split(";")[0]
      .toLowerCase();
    if (!audioAttachment || !isAllowedStreamMediaUrl(mediaUrl)) {
      return res.status(400).json({
        code: "INVALID_AUDIO",
        message: "This message does not contain a supported HyeChat voice note.",
      });
    }
    if (Number(audioAttachment.file_size) > MAX_AUDIO_BYTES) {
      return res.status(413).json({
        code: "AUDIO_TOO_LARGE",
        message: "This voice note is too large to translate.",
      });
    }
    if (!SUPPORTED_AUDIO_TYPES.has(mimeType)) {
      return res.status(415).json({
        code: "UNSUPPORTED_AUDIO_TYPE",
        message: "This voice note format cannot be transcribed.",
      });
    }

    const declaredDuration = Number(audioAttachment.duration || message.duration);
    if (
      Number.isFinite(declaredDuration) &&
      declaredDuration > getMaxAudioDurationSeconds()
    ) {
      return res.status(413).json({
        code: "AUDIO_TOO_LONG",
        message: "This voice note is too long to translate.",
      });
    }

    const [nativeCode, learningCode] = await Promise.all([
      mapProfileLanguageToSpeechCode(req.user.nativeLanguage),
      mapProfileLanguageToSpeechCode(req.user.learningLanguage),
    ]);
    const sourceLanguageCodes = [nativeCode, learningCode].filter(Boolean);
    if (!sourceLanguageCodes.length) {
      throw new TranslationServiceError(
        "SOURCE_LANGUAGE_UNSUPPORTED",
        400,
        "Your profile languages are not currently supported for voice transcription.",
      );
    }

    const { audio, mimeType: downloadedMimeType } = await downloadStreamAudio(
      mediaUrl,
      mimeType,
    );
    let metadata;
    try {
      metadata = await parseBuffer(audio, { mimeType: downloadedMimeType });
    } catch {
      throw new TranslationServiceError(
        "INVALID_AUDIO",
        400,
        "This voice note contains invalid or unreadable audio.",
      );
    }
    const audioDuration = Number(metadata.format.duration);
    if (!Number.isFinite(audioDuration) || audioDuration <= 0) {
      throw new TranslationServiceError(
        "INVALID_AUDIO",
        400,
        "This voice note's duration could not be determined.",
      );
    }
    if (audioDuration > getMaxAudioDurationSeconds()) {
      return res.status(413).json({
        code: "AUDIO_TOO_LONG",
        message: "This voice note is too long to translate.",
      });
    }

    const transcription = await transcribeAudio({
      audio,
      languageCodes: sourceLanguageCodes,
    });

    return res.status(200).json({
      transcript: transcription.transcript,
      sourceLanguage: transcription.sourceLanguage,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}