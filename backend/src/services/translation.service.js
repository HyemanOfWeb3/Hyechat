import { TranslationServiceClient } from "@google-cloud/translate";
import { v2 as speechV2 } from "@google-cloud/speech";

const MAX_TRANSLATION_TEXT_LENGTH = 5000;
const googleLanguageOverrides = new Map([
  ["chinese (simplified)", { code: "zh-CN", name: "Chinese (Simplified)" }],
  ["mandarin", { code: "zh", name: "Mandarin" }],
  ["filipino", { code: "fil", name: "Filipino" }],
  ["fulani", { code: "ff", name: "Fulani" }],
  ["kikongo", { code: "kg", name: "Kikongo" }],
  ["moore", { code: "mos", name: "Moore" }],
  ["tigrinya", { code: "ti", name: "Tigrinya" }],
  ["twi", { code: "ak", name: "Twi" }],
]);
const speechLanguageOverrides = new Map([
  ["af", "af-ZA"],
  ["am", "am-ET"],
  ["ar", "ar-XA"],
  ["bn", "bn-IN"],
  ["de", "de-DE"],
  ["el", "el-GR"],
  ["en", "en-US"],
  ["es", "es-ES"],
  ["fa", "fa-IR"],
  ["fr", "fr-FR"],
  ["gu", "gu-IN"],
  ["ha", "ha-NG"],
  ["he", "he-IL"],
  ["hi", "hi-IN"],
  ["ig", "ig-NG"],
  ["id", "id-ID"],
  ["it", "it-IT"],
  ["ja", "ja-JP"],
  ["ko", "ko-KR"],
  ["mr", "mr-IN"],
  ["ms", "ms-MY"],
  ["nl", "nl-NL"],
  ["pa", "pa-IN"],
  ["pl", "pl-PL"],
  ["pt", "pt-BR"],
  ["ru", "ru-RU"],
  ["sw", "sw-KE"],
  ["ta", "ta-IN"],
  ["te", "te-IN"],
  ["th", "th-TH"],
  ["tr", "tr-TR"],
  ["ur", "ur-PK"],
  ["vi", "vi-VN"],
  ["yo", "yo-NG"],
  ["zh", "zh-CN"],
  ["zu", "zu-ZA"],
]);

let translationClient;
let speechClient;
let supportedLanguageCache;

export class TranslationServiceError extends Error {
  constructor(code, status, message) {
    super(message);
    this.name = "TranslationServiceError";
    this.code = code;
    this.status = status;
  }
}

const getGoogleClientOptions = () => {
  const options = {};
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      options.credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    } catch {
      throw new TranslationServiceError(
        "GOOGLE_CREDENTIALS_INVALID",
        503,
        "Google Cloud credentials are invalid on this server.",
      );
    }
  }
  if (process.env.GOOGLE_CLOUD_PROJECT) {
    options.projectId = process.env.GOOGLE_CLOUD_PROJECT;
  } else if (options.credentials?.project_id) {
    options.projectId = options.credentials.project_id;
  }
  return options;
};

const getTranslationClient = () => {
  const options = getGoogleClientOptions();
  if (!options.projectId) {
    throw new TranslationServiceError(
      "TRANSLATION_NOT_CONFIGURED",
      503,
      "Google Cloud Translation is not configured on this server.",
    );
  }

  translationClient ||= new TranslationServiceClient(options);
  return translationClient;
};

const getSpeechClient = () => {
  const options = getGoogleClientOptions();
  if (!options.projectId) {
    throw new TranslationServiceError(
      "SPEECH_NOT_CONFIGURED",
      503,
      "Google Cloud Speech-to-Text is not configured on this server.",
    );
  }

  speechClient ||= new speechV2.SpeechClient(options);
  return speechClient;
};

const mapProviderError = (error, stage) => {
  const code = Number(error?.code);
  if (code === 7 || code === 16) {
    return new TranslationServiceError(
      stage === "speech"
        ? "SPEECH_NOT_CONFIGURED"
        : "TRANSLATION_NOT_CONFIGURED",
      503,
      "Google Cloud translation is unavailable. Check the server's Google Cloud service configuration.",
    );
  }
  if (code === 8) {
    return new TranslationServiceError(
      "RATE_LIMITED",
      429,
      "Google Cloud is temporarily rate limiting requests. Please try again shortly.",
    );
  }
  if (code === 3 || code === 9) {
    return new TranslationServiceError(
      "UNSUPPORTED_LANGUAGE",
      400,
      "Google Cloud does not support this language for the requested operation.",
    );
  }

  return new TranslationServiceError(
    stage === "speech" ? "TRANSCRIPTION_FAILED" : "TRANSLATION_FAILED",
    502,
    stage === "speech"
      ? "Unable to transcribe this voice note."
      : "Translation is temporarily unavailable. Please try again.",
  );
};

const canonicalLanguageCode = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new TranslationServiceError(
      "MISSING_LANGUAGE",
      400,
      "Set your preferred language in your profile before translating.",
    );
  }
  return value.trim().toLowerCase();
};

export const getSupportedTranslationLanguages = async () => {
  if (supportedLanguageCache && supportedLanguageCache.expiresAt > Date.now()) {
    return supportedLanguageCache.languages;
  }

  try {
    const client = getTranslationClient();
    const projectId =
      process.env.GOOGLE_CLOUD_PROJECT || getGoogleClientOptions().projectId;
    const [response] = await client.getSupportedLanguages({
      parent: `projects/${projectId}/locations/global`,
      displayLanguageCode: "en",
    });
    const languages = (response.languages || [])
      .filter((language) => language.languageCode && language.displayName)
      .map((language) => ({
        code: language.languageCode,
        name: language.displayName,
      }))
      .sort((left, right) => left.name.localeCompare(right.name));

    supportedLanguageCache = {
      languages,
      expiresAt: Date.now() + 60 * 60 * 1000,
    };
    return languages;
  } catch (error) {
    if (error instanceof TranslationServiceError) throw error;
    throw mapProviderError(error, "translation");
  }
};

export const resolveTranslationLanguage = async (value) => {
  const requestedCode = canonicalLanguageCode(value);
  const languages = await getSupportedTranslationLanguages();
  const language = languages.find(
    (candidate) => candidate.code.toLowerCase() === requestedCode,
  );
  if (!language) {
    const override = [...googleLanguageOverrides.values()].find(
      (candidate) => candidate.code.toLowerCase() === requestedCode,
    );
    if (
      override &&
      languages.some(
        (candidate) => candidate.code.toLowerCase() === requestedCode,
      )
    ) {
      return override;
    }
    throw new TranslationServiceError(
      "UNSUPPORTED_LANGUAGE",
      400,
      "Google Cloud does not support the selected translation language.",
    );
  }

  return language;
};

export const mapProfileLanguageToGoogleCode = async (profileLanguage) => {
  if (typeof profileLanguage !== "string" || !profileLanguage.trim())
    return null;
  const normalized = profileLanguage.trim().toLowerCase();
  const languages = await getSupportedTranslationLanguages();
  const directMatch = languages.find(
    (language) => language.code.toLowerCase() === normalized,
  );
  if (directMatch) return directMatch.code;

  const override = googleLanguageOverrides.get(normalized);
  if (
    override &&
    languages.some((language) => language.code === override.code)
  ) {
    return override.code;
  }

  const displayName = normalized.replace(/\s+/g, " ");
  const translationCode =
    languages.find((language) => language.name.toLowerCase() === displayName)
      ?.code || null;
  return translationCode;
};

export const mapProfileLanguageToSpeechCode = async (profileLanguage) => {
  const translationCode = await mapProfileLanguageToGoogleCode(profileLanguage);
  if (!translationCode) return null;
  return (
    speechLanguageOverrides.get(translationCode.toLowerCase()) ||
    (translationCode.includes("-") ? translationCode : null)
  );
};

export const translateText = async (text, targetLanguage) => {
  if (typeof text !== "string" || !text.trim()) {
    throw new TranslationServiceError(
      "INVALID_TEXT",
      400,
      "There is no text to translate.",
    );
  }
  if (text.length > MAX_TRANSLATION_TEXT_LENGTH) {
    throw new TranslationServiceError(
      "TEXT_TOO_LONG",
      413,
      "Messages over 5,000 characters cannot be translated.",
    );
  }

  const language = await resolveTranslationLanguage(targetLanguage);
  try {
    const client = getTranslationClient();
    const projectId =
      process.env.GOOGLE_CLOUD_PROJECT || getGoogleClientOptions().projectId;
    const [translation] = await client.translateText({
      parent: `projects/${projectId}/locations/global`,
      contents: [text],
      targetLanguageCode: language.code,
      mimeType: "text/plain",
    });
    const translatedText =
      translation.translations?.[0]?.translatedText?.trim();
    if (!translatedText) {
      throw new TranslationServiceError(
        "TRANSLATION_FAILED",
        502,
        "Google Cloud returned no translated text.",
      );
    }
    return { translatedText, targetLanguage: language };
  } catch (error) {
    if (error instanceof TranslationServiceError) throw error;
    throw mapProviderError(error, "translation");
  }
};

export const transcribeAudio = async ({ audio, languageCodes }) => {
  if (!Buffer.isBuffer(audio) || !audio.length) {
    throw new TranslationServiceError(
      "INVALID_AUDIO",
      400,
      "This voice note contains no audio data.",
    );
  }

  if (!Array.isArray(languageCodes) || !languageCodes.length) {
    throw new TranslationServiceError(
      "SOURCE_LANGUAGE_REQUIRED",
      400,
      "Add a native or learning language to your profile to transcribe voice notes.",
    );
  }

  const candidateLanguageCodes = [...new Set(languageCodes)].slice(0, 3);
  try {
    const client = getSpeechClient();
    const projectId =
      process.env.GOOGLE_CLOUD_PROJECT || getGoogleClientOptions().projectId;
    if (!projectId) {
      throw new TranslationServiceError(
        "SPEECH_NOT_CONFIGURED",
        503,
        "Google Cloud Speech-to-Text is not configured on this server.",
      );
    }
    const recognizer = `projects/${projectId}/locations/global/recognizers/_`;
    const [response] = await client.recognize({
      recognizer,
      config: {
        autoDecodingConfig: {},
        languageCodes: candidateLanguageCodes,
        model: "long",
        features: { enableAutomaticPunctuation: true },
      },
      content: audio,
    });
    const results = response.results || [];
    const transcript = results
      .map((result) => result.alternatives?.[0]?.transcript?.trim())
      .filter(Boolean)
      .join(" ");
    const sourceLanguage = results.find(
      (result) => result.languageCode,
    )?.languageCode;

    if (!transcript) {
      throw new TranslationServiceError(
        "TRANSCRIPTION_FAILED",
        422,
        "Unable to transcribe this voice note.",
      );
    }

    return { transcript, sourceLanguage: sourceLanguage || null };
  } catch (error) {
    if (error instanceof TranslationServiceError) throw error;
    throw mapProviderError(error, "speech");
  }
};
