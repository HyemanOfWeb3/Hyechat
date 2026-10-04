import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import useAuthUser from "../hooks/useAuthUser.js";
import {
  getTranslationLanguages,
  translateMessage,
  transcribeVoiceNote,
} from "../lib/api.js";

const getTranslationErrorMessage = (error) => {
  const code = error?.response?.data?.code;
  const status = error?.response?.status;
  if (status === 401) return "Sign in again to translate this voice note.";
  if (code === "MISSING_LANGUAGE" || code === "SOURCE_LANGUAGE_REQUIRED") {
    return "Add a native or learning language to your profile first.";
  }
  if (code === "SOURCE_LANGUAGE_UNSUPPORTED") {
    return "Your profile languages are not supported for voice transcription yet.";
  }
  if (code === "TRANSLATION_NOT_CONFIGURED") {
    return "Google Cloud Translation is not configured on this server.";
  }
  if (code === "SPEECH_NOT_CONFIGURED") {
    return "Google Cloud Speech-to-Text is not configured on this server.";
  }
  if (code === "PROVIDER_NOT_CONFIGURED") {
    return "Google Cloud services are unavailable. Check the server configuration.";
  }
  if (code === "UNSUPPORTED_LANGUAGE") {
    return "This language is not supported for this translation.";
  }
  if (code === "UNSUPPORTED_AUDIO_TYPE") {
    return "This voice note format cannot be transcribed.";
  }
  if (code === "AUDIO_TOO_LARGE") return "This voice note is too large to translate.";
  if (code === "AUDIO_TOO_LONG") return "This voice note is too long to translate.";
  if (code === "TRANSCRIPTION_FAILED" || code === "INVALID_AUDIO") {
    return "Unable to transcribe this voice note.";
  }
  if (code === "MEDIA_FORBIDDEN" || code === "MEDIA_UNAVAILABLE") {
    return "You no longer have access to this voice note.";
  }
  if (code === "RATE_LIMITED" || status === 429) {
    return "Translation is busy. Please wait a moment and retry.";
  }
  if (code === "TRANSLATION_FAILED" || status >= 500) {
    return "Translation is temporarily unavailable. Please try again.";
  }
  if (!error?.response) return "Could not reach translation. Check your connection.";
  return "This voice note could not be translated.";
};

const VoiceNoteTranslation = ({ message, attachment }) => {
  const { authUser } = useAuthUser();
  const [isRequested, setIsRequested] = useState(false);
  const [isLanguagePickerOpen, setIsLanguagePickerOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("");
  const [isResultVisible, setIsResultVisible] = useState(true);
  const messageId = message?.id || "";
  const languagesQuery = useQuery({
    queryKey: ["translationLanguages"],
    queryFn: getTranslationLanguages,
    enabled: Boolean(authUser && messageId),
    staleTime: Infinity,
  });
  const languages = languagesQuery.data?.languages || [];
  const preferredCode = languagesQuery.data?.preferredLanguageCode || "";
  const targetLanguage = selectedLanguage || preferredCode;

  const transcriptionQuery = useQuery({
    queryKey: ["voiceTranscription", messageId],
    queryFn: () => transcribeVoiceNote({ messageId }),
    enabled: isRequested && Boolean(messageId && targetLanguage),
    retry: false,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
  });
  const transcript = transcriptionQuery.data?.transcript || "";
  const translationQuery = useQuery({
    queryKey: ["voiceTranslation", messageId, targetLanguage],
    queryFn: () => translateMessage({ text: transcript, targetLanguage }),
    enabled: isRequested && Boolean(transcript && targetLanguage),
    retry: false,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
  });

  const handleTranslate = () => {
    setIsRequested(true);
    if (!targetLanguage) {
      setIsLanguagePickerOpen(true);
      return;
    }
    setIsLanguagePickerOpen(false);
    setIsResultVisible(true);
    if (transcriptionQuery.isError) void transcriptionQuery.refetch();
    if (translationQuery.isError) void translationQuery.refetch();
  };

  const isTranscribing = isRequested && transcriptionQuery.isFetching;
  const isTranslating =
    isRequested && Boolean(transcript) && translationQuery.isFetching;
  const requestError = transcriptionQuery.isError
    ? transcriptionQuery.error
    : translationQuery.isError
      ? translationQuery.error
      : null;
  const errorMessage = requestError
    ? getTranslationErrorMessage(requestError)
    : "";

  return (
    <div className="my-1 w-full max-w-sm rounded-xl border border-base-300 bg-base-100 p-3">
      <audio
        controls
        preload="metadata"
        src={attachment.asset_url || attachment.url}
        className="h-10 w-full"
        aria-label="Play original voice note"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-ghost btn-sm min-h-9"
          onClick={() => {
            if (transcript && translationQuery.data?.translatedText) {
              setIsResultVisible((visible) => !visible);
              return;
            }
            handleTranslate();
          }}
          disabled={isTranscribing || isTranslating}
        >
          {isTranscribing
            ? "Transcribing..."
            : isTranslating
              ? "Translating..."
              : transcript && translationQuery.data?.translatedText
                ? isResultVisible
                  ? "Hide translation"
                  : "Show translation"
                : errorMessage
                  ? "Retry translation"
                  : "Translate voice note"}
        </button>
        {((transcript && translationQuery.data?.translatedText) || errorMessage) && (
          <button
            type="button"
            className="btn btn-ghost btn-sm min-h-9"
            onClick={() => setIsLanguagePickerOpen((open) => !open)}
          >
            {targetLanguage
              ? `To ${languages.find((language) => language.code === targetLanguage)?.name || targetLanguage}`
              : "Choose language"}
          </button>
        )}
      </div>

      {isLanguagePickerOpen && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="form-control min-w-40 flex-1">
            <span className="mb-1 text-xs font-medium">Translate to</span>
            <select
              className="select select-bordered select-sm w-full"
              value={languages.some((language) => language.code === targetLanguage) ? targetLanguage : ""}
              onChange={(event) => setSelectedLanguage(event.target.value)}
              disabled={languagesQuery.isLoading || languagesQuery.isError}
            >
              <option value="">Choose a language</option>
              {languages.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleTranslate}
            disabled={!targetLanguage || isTranscribing || isTranslating}
          >
            Translate
          </button>
          {languagesQuery.isLoading && (
            <span className="loading loading-spinner loading-xs" aria-label="Loading languages" />
          )}
          {languagesQuery.isError && (
            <p className="w-full text-xs text-error">
              {getTranslationErrorMessage(languagesQuery.error)}
              <button
                type="button"
                className="ml-1 underline"
                onClick={() => void languagesQuery.refetch()}
              >
                Retry
              </button>
            </p>
          )}
        </div>
      )}

      {isRequested && !targetLanguage && !errorMessage && (
        <p className="mt-2 text-xs text-base-content/70">
          Choose a target language to translate this voice note.
        </p>
      )}
      {errorMessage && (
        <p role="status" className="mt-2 text-xs text-error">
          {errorMessage}
        </p>
      )}

      {transcript && (
        <div className="mt-2 space-y-2 rounded-lg bg-base-200 p-2.5 text-sm">
          <div>
            <p className="mb-0.5 text-[11px] font-semibold text-base-content/60">
              Original transcript
              {transcriptionQuery.data?.sourceLanguage &&
                ` · ${transcriptionQuery.data.sourceLanguage}`}
            </p>
            <p className="whitespace-pre-wrap break-words">{transcript}</p>
          </div>
          {isResultVisible && translationQuery.data?.translatedText && (
            <div className="border-t border-base-300 pt-2">
              <p className="mb-0.5 text-[11px] font-semibold text-primary">
                Translated to: {translationQuery.data.targetLanguageName || targetLanguage}
              </p>
              <p className="whitespace-pre-wrap break-words">
                {translationQuery.data.translatedText}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VoiceNoteTranslation;