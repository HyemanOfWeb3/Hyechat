import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import useStreamClient from "../hooks/useStreamClient";
import { useQuery } from "@tanstack/react-query";
import {
  getTranslationLanguages,
  getStreamToken,
  getUserFriends,
  startCallHistory,
  translateMessage,
} from "../lib/api.js";
import { toast } from "react-hot-toast";
import {
  Video,
  Phone,
  Search,
  SmilePlus,
  Mic,
  Play,
  Pause,
  ArrowLeft,
  Languages,
} from "lucide-react";

import {
  Attachment as DefaultAttachment,
  Chat,
  Channel,
  ChannelHeader,
  MessageList,
  MessageComposer,
  Thread,
  Window,
  useChannelActionContext,
  useChannelStateContext,
  MessageUI,
  useMessageContext,
} from "stream-chat-react";
import ChatLoader from "../components/ChatLoader.jsx";
import CallButton from "../components/CallButton.jsx";
import HyeChatCallCard from "../components/HyeChatCallCard.jsx";
import MediaViewer from "../components/MediaViewer.jsx";
import { getHyeChatCallDetails } from "../lib/hyeChatCall.js";
import StoryReplyPreview from "../components/stories/StoryReplyPreview.jsx";
import VoiceNoteTranslation from "../components/VoiceNoteTranslation.jsx";
import { buildChatChannelId } from "../lib/utils.js";
import { getStreamVideoClient } from "../lib/streamVideoClient.js";

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const highlightText = (text, query) => {
  if (!query || !text) return text;

  const parts = String(text).split(
    new RegExp(`(${escapeRegExp(query)})`, "ig"),
  );

  return parts.map((part, index) => {
    const isMatch = part.toLowerCase() === query.toLowerCase();

    return isMatch ? (
      <mark
        key={`${part}-${index}`}
        className="rounded bg-amber-200 px-0.5 text-slate-900"
      >
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    );
  });
};

const AutoScrollToInitialMessage = () => {
  const { jumpToLatestMessage, jumpToFirstUnreadMessage } =
    useChannelActionContext();
  const { channelUnreadUiState, messages } = useChannelStateContext();
  const hasScrolledRef = useRef(false);

  useEffect(() => {
    if (hasScrolledRef.current) return;
    if (!messages?.length) return;

    const timer = window.setTimeout(async () => {
      try {
        if (
          channelUnreadUiState?.unread_messages > 0 &&
          jumpToFirstUnreadMessage
        ) {
          await jumpToFirstUnreadMessage();
        } else if (jumpToLatestMessage) {
          await jumpToLatestMessage();
        }
      } catch (error) {
        console.error("Could not scroll to initial message:", error);
      } finally {
        hasScrolledRef.current = true;
      }
    }, 180);

    return () => window.clearTimeout(timer);
  }, [
    channelUnreadUiState?.unread_messages,
    jumpToFirstUnreadMessage,
    jumpToLatestMessage,
    messages?.length,
  ]);

  return null;
};

const UnreadMessagesShortcut = () => {
  const { jumpToFirstUnreadMessage } = useChannelActionContext();
  const { channel, channelUnreadUiState } = useChannelStateContext();
  const unreadCount = channelUnreadUiState?.unread_messages ?? 0;

  const handleJumpToUnread = async () => {
    if (!jumpToFirstUnreadMessage) return;

    try {
      await jumpToFirstUnreadMessage();
      await channel?.markRead?.();
    } catch (error) {
      console.error("Could not jump to first unread message:", error);
    }
  };

  if (!unreadCount) return null;

  return (
    <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2">
      <button
        type="button"
        onClick={handleJumpToUnread}
        className="flex items-center gap-2 rounded-full border border-sky-200 bg-white/95 px-3 py-1.5 text-sm font-medium text-sky-700 shadow-lg backdrop-blur"
      >
        <span className="rounded-full bg-sky-600 px-2 py-0.5 text-xs font-semibold text-white">
          {unreadCount}
        </span>
        <span>{unreadCount === 1 ? "Unread message" : "Unread messages"}</span>
      </button>
    </div>
  );
};

const getTranslationErrorMessage = (error) => {
  const code = error?.response?.data?.code;
  const status = error?.response?.status;

  if (status === 401) return "Your session expired. Sign in again to translate.";
  if (code === "MISSING_LANGUAGE") return "Set your preferred language in your profile before translating.";
  if (code === "UNSUPPORTED_LANGUAGE") return "Choose another supported language.";
  if (code === "TRANSLATION_NOT_CONFIGURED") return "Google Cloud Translation is not configured on this server.";
  if (code === "PROVIDER_NOT_CONFIGURED") return "Google Cloud translation is unavailable. Check the server configuration.";
  if (code === "RATE_LIMITED" || status === 429) {
    return "Translation is busy right now. Please wait and try again.";
  }
  if (code === "INVALID_TEXT") return "There is no translatable text in this message.";
  if (code === "TEXT_TOO_LONG" || status === 413) {
    return "This message is too long to translate.";
  }
  if (code === "TRANSLATION_FAILED" || status >= 500) {
    return "Translation service is currently unavailable.";
  }
  if (!error?.response) return "Could not reach the translation service. Check your connection.";
  return "This message could not be translated. Try again.";
};

const fingerprintTranslationText = (text) => {
  let hash = 2166136261;
  for (let characterIndex = 0; characterIndex < text.length; characterIndex += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(characterIndex), 16777619);
  }
  return `${text.length}:${hash >>> 0}`;
};

const StoryReplyMessage = ({ message: messageProp }) => {
  const { message: contextMessage } = useMessageContext();
  const message = messageProp || contextMessage;
  const callDetails = message ? getHyeChatCallDetails(message.text) : null;
  const hasAudioAttachment = (message?.attachments || []).some((attachment) => {
    const mimeType = String(attachment?.mime_type || "").toLowerCase();
    return (
      mimeType.startsWith("audio/") ||
      ["audio", "voice"].includes(String(attachment?.type || "").toLowerCase()) ||
      /voice note/i.test(attachment?.title || "")
    );
  });
  const hasUnsupportedAttachment = (message?.attachments || []).some(
    (attachment) =>
      String(attachment?.type || "").toLowerCase() === "file" ||
      String(attachment?.mime_type || "").toLowerCase().startsWith("application/"),
  );
  const canTranslate = Boolean(
    message?.user?.id &&
      message.type !== "system" &&
      message.type !== "deleted" &&
      message.type !== "error" &&
      message.type !== "ephemeral" &&
      !message.deleted_at &&
      !callDetails &&
      !hasAudioAttachment &&
      !hasUnsupportedAttachment &&
      typeof message.text === "string" &&
      message.text.trim(),
  );
  const [selectedLanguage, setSelectedLanguage] = useState("");
  const [isLanguagePickerOpen, setIsLanguagePickerOpen] = useState(false);
  const [showingTranslationKey, setShowingTranslationKey] = useState("");
  const languageQuery = useQuery({
    queryKey: ["translationLanguages"],
    queryFn: getTranslationLanguages,
    enabled: canTranslate,
    staleTime: Infinity,
  });
  const targetLanguage =
    selectedLanguage || languageQuery.data?.preferredLanguageCode || "";
  const messageId = message?.id || "";
  const sourceText = message?.text || "";
  const cacheKey = JSON.stringify([
    "messageTranslation",
    messageId,
    targetLanguage,
    fingerprintTranslationText(sourceText),
  ]);
  const translationQuery = useQuery({
    queryKey: [
      "messageTranslation",
      messageId,
      targetLanguage,
      fingerprintTranslationText(sourceText),
    ],
    queryFn: () => translateMessage({ text: sourceText, targetLanguage }),
    enabled: canTranslate && Boolean(targetLanguage) && showingTranslationKey === cacheKey,
    retry: false,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
  });
  const isShowingTranslation =
    showingTranslationKey === cacheKey && Boolean(translationQuery.data?.translatedText);
  const isTranslating =
    showingTranslationKey === cacheKey && translationQuery.isFetching;
  const translationError =
    showingTranslationKey === cacheKey && translationQuery.isError
      ? getTranslationErrorMessage(translationQuery.error)
      : "";

  const handleTranslate = () => {
    if (isTranslating) return;
    if (isShowingTranslation) {
      setShowingTranslationKey("");
      return;
    }
    if (!targetLanguage) {
      setIsLanguagePickerOpen(true);
      return;
    }
    setIsLanguagePickerOpen(false);
    setShowingTranslationKey(cacheKey);
    if (translationQuery.isError) void translationQuery.refetch();
  };

  const openLanguagePicker = () => {
    setShowingTranslationKey("");
    setIsLanguagePickerOpen(true);
  };

  const handleTranslateSelectedLanguage = () => {
    if (!targetLanguage || isTranslating) return;
    setIsLanguagePickerOpen(false);
    setShowingTranslationKey(cacheKey);
    if (translationQuery.isError) void translationQuery.refetch();
  };

  const languages = languageQuery.data?.languages || [];
  if (callDetails) {
    return (
      <HyeChatCallCard
        {...callDetails}
        createdBy={message.user?.name || message.user?.id}
      />
    );
  }

  return (
    <div>
      {message?.story_id && (
        <StoryReplyPreview
          storyMediaUrl={message.story_media_url}
          storyMediaType={message.story_media_type}
          storyText={message.story_text}
          storyOwnerName={message.story_owner_name || "User"}
          isDark={false}
        />
      )}
      <div className="flex flex-col gap-1">
        <MessageUI />
        {canTranslate && (
              <>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-500">
                  <button
                    type="button"
                    onClick={handleTranslate}
                    disabled={isTranslating}
                    className="inline-flex min-h-8 items-center rounded-full border border-slate-200 bg-white/70 px-2.5 py-1 hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isTranslating
                      ? "Translating..."
                      : isShowingTranslation
                        ? "Hide translation"
                        : translationError
                          ? "Try again"
                          : "Translate"}
                  </button>
                  {(isShowingTranslation || translationError) && (
                    <button
                      type="button"
                      onClick={openLanguagePicker}
                      className="inline-flex min-h-8 items-center gap-1 rounded-full px-2 hover:bg-base-200"
                      aria-label="Change translation language"
                    >
                      <Languages className="size-3.5" />
                      Change language
                    </button>
                  )}
                </div>

                {isLanguagePickerOpen && (
                  <div className="mt-2 flex max-w-sm flex-wrap items-end gap-2 rounded-lg border border-base-300 bg-base-100 p-2">
                    <label className="form-control min-w-40 flex-1">
                      <span className="mb-1 text-[11px] font-medium text-base-content/70">
                        Translate to
                      </span>
                      <select
                        className="select select-bordered select-sm w-full"
                        value={languages.some((language) => language.code === targetLanguage) ? targetLanguage : ""}
                        onChange={(event) => setSelectedLanguage(event.target.value)}
                        disabled={languageQuery.isLoading || languageQuery.isError}
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
                      onClick={handleTranslateSelectedLanguage}
                      disabled={!targetLanguage || isTranslating || languageQuery.isLoading}
                    >
                      Translate
                    </button>
                    {languageQuery.isLoading && (
                      <span className="loading loading-spinner loading-xs" aria-label="Loading languages" />
                    )}
                    {languageQuery.isError && (
                      <span className="w-full text-xs text-error">
                        {getTranslationErrorMessage(languageQuery.error)}
                        <button
                          type="button"
                          className="ml-1 underline"
                          onClick={() => void languageQuery.refetch()}
                        >
                          Retry
                        </button>
                      </span>
                    )}
                  </div>
                )}

                {translationError && (
                  <p role="status" className="mt-1 text-xs text-error">
                    {translationError}
                  </p>
                )}

                {isShowingTranslation && (
                  <div className="mt-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-slate-700 shadow-sm">
                    <p className="mb-1 text-[10px] font-semibold text-sky-700">
                      Translated to: {translationQuery.data.targetLanguageName || targetLanguage}
                    </p>
                    <p className="whitespace-pre-wrap break-words">
                      {translationQuery.data.translatedText}
                    </p>
                  </div>
                )}
              </>
            )}
      </div>
    </div>
  );
};

const isSupportedChatImage = (attachment) => {
  if (!attachment) return false;

  const mimeType = attachment.mime_type || attachment.type || "";
  const url =
    attachment.image_url ||
    attachment.asset_url ||
    attachment.thumb_url ||
    attachment.url;

  if (!url) return false;

  return (
    attachment.type === "image" ||
    mimeType.startsWith("image/") ||
    /\.(png|jpe?g|webp|gif)(?:\?|$)/i.test(url)
  );
};

const getChatImageMedia = (attachment) => {
  if (!attachment || !isSupportedChatImage(attachment)) return null;

  const url =
    attachment.image_url ||
    attachment.asset_url ||
    attachment.thumb_url ||
    attachment.url;

  if (!url) return null;

  return {
    type: "image",
    url,
    alt: attachment.title || attachment.fallback || "Shared image",
  };
};

const ChatAttachmentRenderer = ({ attachments = [], ...props }) => {
  const { message } = useMessageContext();
  const imageAttachments = attachments.filter(isSupportedChatImage);
  const voiceAttachments = attachments.filter((attachment) => {
    const mimeType = String(attachment?.mime_type || "").toLowerCase();
    return (
      mimeType.startsWith("audio/") &&
      (attachment?.type === "audio" || /voice note/i.test(attachment?.title || ""))
    );
  });
  const voiceAttachmentSet = new Set(voiceAttachments);
  const remainingAttachments = attachments.filter(
    (attachment) =>
      !isSupportedChatImage(attachment) && !voiceAttachmentSet.has(attachment),
  );

  if (!imageAttachments.length && !voiceAttachments.length) {
    return <DefaultAttachment attachments={attachments} {...props} />;
  }

  return (
    <div className="flex flex-col gap-2">
      {voiceAttachments.map((attachment, index) => (
        <VoiceNoteTranslation
          key={attachment.id || attachment.asset_url || index}
          message={message}
          attachment={attachment}
        />
      ))}
      {imageAttachments.map((attachment, index) => {
        const media = getChatImageMedia(attachment);

        if (!media) return null;

        return (
          <button
            key={
              attachment.id ||
              attachment.asset_url ||
              attachment.image_url ||
              attachment.thumb_url ||
              index
            }
            type="button"
            onClick={() => props.onOpenMedia?.(media)}
            className="block w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-900 text-left outline-none transition hover:opacity-95 focus-visible:ring-2 focus-visible:ring-purple-400"
            aria-label={`Open image: ${media.alt}`}
          >
            <img
              src={media.url}
              alt={media.alt}
              className="max-h-72 w-full object-contain bg-slate-900"
            />
          </button>
        );
      })}

      {remainingAttachments.length > 0 && (
        <DefaultAttachment attachments={remainingAttachments} {...props} />
      )}
    </div>
  );
};

const ChatPage = () => {
  const { id: targetUserId } = useParams();
  const navigate = useNavigate();
  const normalizedTargetId = typeof targetUserId === "string" ? targetUserId.trim() : "";

  const [chatClient, setChatClient] = useState(null);
  const [channel, setChannel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initializationError, setInitializationError] = useState("");
  const [peerUser, setPeerUser] = useState(null);
  const [isPeerOnline, setIsPeerOnline] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [voiceRecorder, setVoiceRecorder] = useState(null);
  const [voiceBlob, setVoiceBlob] = useState(null);
  const [voiceUrl, setVoiceUrl] = useState("");
  const [audioDuration, setAudioDuration] = useState(0);
  const [isSendingVoiceNote, setIsSendingVoiceNote] = useState(false);
  const [isVoicePlaying, setIsVoicePlaying] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [waveformBars, setWaveformBars] = useState(
    Array.from({ length: 18 }, () => 0.3),
  );

  const { authUser } = useAuthUser();

  // Use persistent shared Stream client across entire app
  const { client: streamClient, connectionState } = useStreamClient();

  useEffect(() => {
    const updateViewportHeight = () => {
      document.documentElement.style.setProperty(
        "--chat-visual-viewport-height",
        `${window.visualViewport?.height || window.innerHeight}px`,
      );
    };

    updateViewportHeight();
    window.visualViewport?.addEventListener("resize", updateViewportHeight);
    window.visualViewport?.addEventListener("scroll", updateViewportHeight);
    window.addEventListener("orientationchange", updateViewportHeight);

    return () => {
      window.visualViewport?.removeEventListener(
        "resize",
        updateViewportHeight,
      );
      window.visualViewport?.removeEventListener(
        "scroll",
        updateViewportHeight,
      );
      window.removeEventListener("orientationchange", updateViewportHeight);
    };
  }, []);

  const { data: friends = [] } = useQuery({
    queryKey: ["friends"],
    queryFn: getUserFriends,
    enabled: !!authUser,
  });

  const { data: tokenData } = useQuery({
    queryKey: ["streamToken"],
    queryFn: getStreamToken,
    enabled: !!authUser, // this will run only when authUser is available
  });

  const initializeChat = useCallback(async () => {
    // Wait for Stream client to be connected
    if (!streamClient || connectionState !== "connected") {
      if (connectionState === "connecting") {
        setInitializationError("Connecting to chat...");
      } else if (connectionState === "disconnected") {
        setInitializationError("Could not connect to chat. Please try again.");
      }
      setLoading(false);
      return;
    }

    if (!authUser || !normalizedTargetId || normalizedTargetId === "undefined" || normalizedTargetId === "null") {
      setInitializationError("This chat is unavailable.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setInitializationError("");
    setChatClient(null);
    setChannel(null);

    try {
      console.log("Initializing chat channel with persistent Stream client...");

      const routeLooksLikeChannelId =
        typeof normalizedTargetId === "string" &&
        (normalizedTargetId.startsWith("messaging:") ||
          normalizedTargetId.includes(":") ||
          (normalizedTargetId.includes("-") && normalizedTargetId.length <= 64));

      const channelId = routeLooksLikeChannelId
        ? normalizedTargetId
        : buildChatChannelId(authUser._id, normalizedTargetId);

      const currChannel = streamClient.channel("messaging", channelId, {
        ...(routeLooksLikeChannelId
          ? {}
          : { members: [authUser._id, normalizedTargetId] }),
      });

      await currChannel.watch();

      // Mark channel as read when user enters the conversation
      // This ensures unread messages become read only when user explicitly opens the chat
      try {
        await currChannel.markRead();
      } catch (markReadError) {
        console.warn("Could not mark channel as read:", markReadError);
      }

      setChatClient(streamClient);
      setChannel(currChannel);

      const matchedFriend = friends.find(
        (friend) => friend._id === normalizedTargetId,
      );
      const channelPeer = Object.values(currChannel.state?.members || {}).find(
        (member) => member.user_id !== authUser._id,
      );
      const nextPeerUser = matchedFriend
        ? {
            id: matchedFriend._id,
            name: matchedFriend.fullName,
            image: matchedFriend.profilePic,
          }
        : channelPeer
          ? {
              id: channelPeer.user_id,
              name: channelPeer.user?.name || channelPeer.name || normalizedTargetId,
              image: channelPeer.user?.image || channelPeer.image || null,
            }
          : {
              id: normalizedTargetId,
              name: normalizedTargetId,
              image: null,
            };

      setPeerUser(nextPeerUser);
      setIsPeerOnline(Boolean(matchedFriend?.isOnline));

      const presenceState = streamClient.state?.users?.[normalizedTargetId];
      if (presenceState?.online !== undefined) {
        setIsPeerOnline(Boolean(presenceState.online));
      }
    } catch (error) {
      console.log("Error initializing chat channel:", error);
      setInitializationError("Could not connect to chat. Please try again.");
      toast.error("Could not connect to chat. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [streamClient, connectionState, authUser, friends, normalizedTargetId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(initializeChat, 0);
    return () => window.clearTimeout(timeoutId);
  }, [initializeChat]);

  // REMOVED: disconnectUser cleanup effect - DO NOT disconnect the shared client!
  // The persistent Stream client should remain connected for the entire session.

  useEffect(() => {
    if (!channel) return;

    const handleTypingStart = () => setIsTyping(true);
    const handleTypingStop = () => setIsTyping(false);

    channel.on("typing.start", handleTypingStart);
    channel.on("typing.stop", handleTypingStop);

    return () => {
      channel.off("typing.start", handleTypingStart);
      channel.off("typing.stop", handleTypingStop);
    };
  }, [channel]);

  useEffect(() => {
    if (!isVoiceRecording) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
      setWaveformBars((prev) =>
        prev.map((value, index) => {
          const wave = Math.max(
            0.18,
            Math.sin(Date.now() / 180 + index * 0.45) * 0.45 + 0.5,
          );
          return index === prev.length - 1 ? wave : value * 0.7 + wave * 0.3;
        }),
      );
    }, 200);

    return () => window.clearInterval(interval);
  }, [isVoiceRecording]);

  const searchResults = useMemo(() => {
    if (!channel?.state?.messages) return [];

    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) return channel.state.messages;

    return channel.state.messages.filter((message) => {
      const text = message?.text?.toLowerCase?.() ?? "";
      const senderName = message?.user?.name?.toLowerCase?.() ?? "";

      return (
        text.includes(normalizedQuery) || senderName.includes(normalizedQuery)
      );
    });
  }, [channel, searchQuery]);

  const handleVideoCall = async () => {
    if (channel) {
      const callId = crypto.randomUUID();
      const callUrl = `${window.location.origin}/call/${callId}?type=video&chatId=${channel.id}&participantId=${normalizedTargetId}`;

      startCallHistory({
        roomId: callId,
        callType: "video",
        participantIds: [normalizedTargetId],
        answered: false,
      }).catch(() => {});
      try {
        const videoClient = await getStreamVideoClient({
          user: authUser,
          token: tokenData.token,
        });
        await videoClient.call("default", callId).getOrCreate({
          data: { members: [{ user_id: normalizedTargetId }] },
          ring: true,
          video: true,
        });
      } catch (error) {
        console.error("Could not ring video call", error);
      }
      channel.sendMessage({
        text: `I've started a video call! Join me here: ${callUrl}`,
      });

      toast.success("Video call link sent successfully!");
    }
  };

  const handleVoiceCall = async () => {
    if (channel) {
      const callId = crypto.randomUUID();
      const callUrl = `${window.location.origin}/call/${callId}?type=voice&chatId=${channel.id}&participantId=${normalizedTargetId}`;

      startCallHistory({
        roomId: callId,
        callType: "voice",
        participantIds: [normalizedTargetId],
        answered: false,
      }).catch(() => {});
      try {
        const videoClient = await getStreamVideoClient({
          user: authUser,
          token: tokenData.token,
        });
        await videoClient.call("default", callId).getOrCreate({
          data: { members: [{ user_id: normalizedTargetId }] },
          ring: true,
          video: false,
        });
      } catch (error) {
        console.error("Could not ring voice call", error);
      }
      channel.sendMessage({
        text: `☎️ I started a voice call. Join here: ${callUrl}`,
      });

      toast.success("Voice call link sent successfully!");
    }
  };

  const handleSearchToggle = () => {
    setIsSearchOpen((prev) => !prev);
    setShowEmojiPicker(false);
  };

  const handleEmojiToggle = () => {
    setShowEmojiPicker((prev) => !prev);
    setIsSearchOpen(false);
  };

  const handleEmojiSelect = (emoji) => {
    if (!channel) return;

    channel.sendMessage({ text: emoji });
    setShowEmojiPicker(false);
  };

  const handleVoiceNoteToggle = async () => {
    if (isVoiceRecording) {
      voiceRecorder?.stop();
      setIsVoiceRecording(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Audio recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);

        audio.addEventListener("loadedmetadata", () => {
          setAudioDuration(Math.round(audio.duration || 0));
        });

        setVoiceBlob(blob);
        setVoiceUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setVoiceRecorder(recorder);
      setVoiceBlob(null);
      setVoiceUrl("");
      setAudioDuration(0);
      setRecordingSeconds(0);
      setWaveformBars(Array.from({ length: 18 }, () => 0.3));
      setIsVoiceRecording(true);
      toast.success("Recording started. Tap again to stop.");
    } catch (error) {
      console.error(error);
      toast.error("Microphone access was denied.");
    }
  };

  const handleVoicePreviewToggle = () => {
    if (!voiceUrl) return;

    const audio = new Audio(voiceUrl);
    if (isVoicePlaying) {
      audio.pause();
      setIsVoicePlaying(false);
      return;
    }

    audio.play().catch(() => {
      toast.error("Playback could not start.");
    });
    setIsVoicePlaying(true);
  };

  const handleSendVoiceNote = async () => {
    if (!voiceBlob || !channel || isSendingVoiceNote) return;

    setIsSendingVoiceNote(true);

    try {
      const file = new File([voiceBlob], "voice-note.webm", {
        type: "audio/webm",
      });

      const uploadResponse = await channel.sendFile(file, file.name, file.type);

      await channel.sendMessage({
        text: "",
        attachments: [
          {
            type: "audio",
            asset_url: uploadResponse.file,
            mime_type: file.type,
            title: "Voice note",
            file_size: file.size,
            duration: audioDuration,
          },
        ],
      });

      setVoiceBlob(null);
      setVoiceUrl("");
      setAudioDuration(0);
      setRecordingSeconds(0);
      setWaveformBars(Array.from({ length: 18 }, () => 0.3));
      setVoiceRecorder(null);
      toast.success("Voice note sent.");
    } catch (error) {
      console.error(error);
      toast.error("Could not send the voice note. Please try again.");
    } finally {
      setIsSendingVoiceNote(false);
    }
  };

  const handleSelectSearchResult = (messageId) => {
    if (!channel || !messageId) return;

    const targetMessage = channel.state.messages.find(
      (message) => message.id === messageId,
    );

    if (!targetMessage) return;

    setHighlightedMessageId(messageId);
    setSearchQuery("");
    setIsSearchOpen(false);
  };

  if (loading) return <ChatLoader />;

  if (initializationError || !chatClient || !channel) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-error">
          {initializationError || "This chat is unavailable."}
        </p>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={initializeChat}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="chat-page-shell flex h-full min-h-0 w-full max-w-full overflow-hidden">
      <Chat client={chatClient} theme="str-chat__theme-light">
        <Channel
          channel={channel}
          Message={StoryReplyMessage}
          components={{
            Attachment: (attachmentProps) => (
              <ChatAttachmentRenderer
                {...attachmentProps}
                onOpenMedia={setSelectedMedia}
              />
            ),
          }}
        >
          <AutoScrollToInitialMessage />
          <UnreadMessagesShortcut />
          <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden touch-pan-y">
            <div className="sticky top-0 z-30 flex min-h-[73px] shrink-0 flex-col justify-center gap-2 border-b border-slate-200 bg-slate-50/95 px-3 py-2 shadow-sm backdrop-blur sm:h-[73px] sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4 sm:py-3">
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/chat")}
                  className="btn btn-ghost btn-square btn-sm min-h-11 min-w-11 shrink-0 sm:hidden"
                  aria-label="Back to chats"
                >
                  <ArrowLeft className="size-5" aria-hidden="true" />
                </button>
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
                  {peerUser?.image ? (
                    <img
                      src={peerUser.image}
                      alt={peerUser.name || "User"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    (peerUser?.name || "U").charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {peerUser?.name || "Chat"}
                    </p>
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        isTyping
                          ? "bg-amber-500"
                          : isPeerOnline
                            ? "bg-emerald-500"
                            : "bg-slate-300"
                      }`}
                    />
                  </div>
                  <p className="text-xs font-medium text-slate-500">
                    {isTyping
                      ? "typing..."
                      : isPeerOnline
                        ? "Online"
                        : "Offline"}
                  </p>
                </div>
              </div>

              <div className="flex w-full min-w-0 items-center justify-end gap-1.5 sm:w-auto sm:gap-2">
                {isSearchOpen ? (
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search chat"
                    className="input input-sm h-9 min-w-0 flex-1 rounded-full border-slate-300 bg-white px-3 text-sm sm:w-[220px] sm:flex-none"
                  />
                ) : null}
                <button
                  type="button"
                  onClick={handleSearchToggle}
                  className="btn btn-ghost btn-sm hover:bg-slate-200"
                  aria-label="Search messages"
                >
                  <Search className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleVoiceCall}
                  className="btn btn-ghost btn-sm hover:bg-slate-200"
                  aria-label="Start voice call"
                >
                  <Phone className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleVideoCall}
                  className="btn btn-success btn-sm text-white shadow-sm"
                  aria-label="Start video call"
                >
                  <Video className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="relative flex min-h-0 flex-1 flex-col bg-slate-50">
              <div className="chat-window-shell flex h-full min-h-0 flex-1 flex-col overflow-hidden">
                <Window>
                  <MessageList
                    highlightedMessageId={highlightedMessageId}
                    className="bg-slate-50 px-4 py-3"
                    showUnreadNotificationAlways
                    Message={StoryReplyMessage}
                  />
                  <div className="chat-composer relative border-t border-slate-200 bg-white px-3 py-2 shadow-[0_-4px_12px_rgba(15,23,42,0.04)]">
                    {voiceUrl ? (
                      <div className="mb-3 flex items-center gap-3 rounded-3xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white px-3 py-2.5 shadow-sm">
                        <button
                          type="button"
                          onClick={handleVoicePreviewToggle}
                          className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm"
                        >
                          {isVoicePlaying ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </button>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                            Voice note ready
                          </span>
                          <div className="mt-1 flex items-center gap-2">
                            <div className="h-2 flex-1 rounded-full bg-emerald-100">
                              <div className="h-2 w-3/4 rounded-full bg-emerald-500" />
                            </div>
                            <span className="shrink-0 text-xs font-medium text-slate-500">
                              {audioDuration}s
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleSendVoiceNote}
                          disabled={isSendingVoiceNote}
                          className="btn btn-success btn-sm text-white"
                        >
                          {isSendingVoiceNote ? "Sending..." : "Send"}
                        </button>
                      </div>
                    ) : null}
                    {isVoiceRecording ? (
                      <div className="mb-3 flex items-center gap-3 rounded-3xl border border-rose-200 bg-rose-50/90 px-3 py-2.5 shadow-sm">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500 text-white shadow-sm">
                          <Mic className="h-4 w-4" />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-rose-700">
                              Recording
                            </span>
                            <span className="text-xs font-medium text-rose-600">
                              {recordingSeconds}s
                            </span>
                          </div>
                          <div className="mt-1 flex h-3 items-end gap-1">
                            {waveformBars.map((bar, index) => (
                              <div
                                key={`${bar}-${index}`}
                                className="w-1 rounded-full bg-rose-500"
                                style={{
                                  height: `${Math.max(18, bar * 100)}%`,
                                }}
                              />
                            ))}
                          </div>
                        </div>
                        <span className="text-xs font-medium text-slate-500">
                          Tap mic to stop
                        </span>
                      </div>
                    ) : null}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleEmojiToggle}
                        className="btn btn-ghost btn-sm min-h-11 min-w-11 hover:bg-slate-200"
                        aria-label="Add emoji or sticker"
                      >
                        <SmilePlus className="h-4 w-4" />
                      </button>
                      <div className="flex-1">
                        <MessageComposer
                          shouldSubmit={() => false}
                          minRows={1}
                          maxRows={6}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleVoiceNoteToggle}
                        className={`btn btn-sm min-h-11 min-w-11 ${isVoiceRecording ? "btn-error text-white" : "btn-ghost hover:bg-slate-200"}`}
                        aria-label="Toggle voice note"
                      >
                        <Mic className="h-4 w-4" />
                      </button>
                    </div>
                    {showEmojiPicker ? (
                      <div className="absolute bottom-16 left-3 z-30 flex max-w-[280px] flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                        {[
                          "😊",
                          "😂",
                          "❤️",
                          "👍",
                          "🎉",
                          "🔥",
                          "🙏",
                          "🥰",
                          "😎",
                          "✨",
                        ].map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleEmojiSelect(emoji)}
                            className="rounded-lg px-2 py-1 text-xl transition hover:bg-slate-100"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </Window>
              </div>

              {searchQuery.trim() ? (
                <div className="absolute inset-x-3 top-3 z-20 flex max-h-[70%] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <span>
                      {searchResults.length} result
                      {searchResults.length === 1 ? "" : "s"}
                    </span>
                    <span>Scroll to review</span>
                  </div>
                  <div className="overflow-y-auto px-3 py-3">
                    {searchResults.length ? (
                      searchResults.map((message) => (
                        <button
                          key={message.id}
                          type="button"
                          onClick={() => handleSelectSearchResult(message.id)}
                          className="mb-3 block w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-100"
                        >
                          <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                            <span className="font-semibold text-slate-700">
                              {message.user?.name || "User"}
                            </span>
                            <span>
                              {message.created_at
                                ? new Date(message.created_at).toLocaleString(
                                    [],
                                    {
                                      hour: "numeric",
                                      minute: "2-digit",
                                    },
                                  )
                                : ""}
                            </span>
                          </div>
                          <div className="text-sm leading-6 text-slate-700">
                            {highlightText(
                              message.text || "No message content",
                              searchQuery,
                            )}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
                        No matching messages found.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <Thread />
        </Channel>
      </Chat>
      {selectedMedia && (
        <MediaViewer
          media={selectedMedia}
          onClose={() => setSelectedMedia(null)}
        />
      )}
    </div>
  );
};

export default ChatPage;
