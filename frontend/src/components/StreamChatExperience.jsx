import { useState, useEffect, useRef } from "react";
import {
  Send,
  Phone,
  Video,
  Paperclip,
  Smile,
  MoreVertical,
  Check,
  CheckCheck,
  Mic,
  MicOff,
  VideoOff,
  PhoneOff,
  X,
  Pencil,
  Trash2,
  Pin,
  Reply,
} from "lucide-react";
import toast from "react-hot-toast";
import StoryReplyPreview from "./stories/StoryReplyPreview.jsx";
import UserAvatar from "./UserAvatar.jsx";

// Mapping of emoji to valid Stream Chat reaction types
const EMOJI_REACTIONS = [
  { emoji: "👍", type: "thumbs_up" },
  { emoji: "❤️", type: "heart" },
  { emoji: "😂", type: "laugh" },
  { emoji: "😮", type: "surprised" },
  { emoji: "😢", type: "sad" },
  { emoji: "🔥", type: "fire" },
  { emoji: "👏", type: "clap" },
  { emoji: "💯", type: "hundred" },
];

// Helper function to convert reaction type to emoji
const getEmojiForType = (type) => {
  const reaction = EMOJI_REACTIONS.find((r) => r.type === type);
  return reaction?.emoji || type;
};

// Helper function to get reaction type from emoji
const getTypeForEmoji = (emoji) => {
  const reaction = EMOJI_REACTIONS.find((r) => r.emoji === emoji);
  return reaction?.type || emoji;
};

const getInitialUserStatus = (chatClient, targetUser) => {
  try {
    const presenceData = chatClient?.state?.users || {};
    const targetUserData = presenceData[targetUser?.id];
    if (targetUserData?.online !== undefined) {
      return targetUserData.online ? "online" : "offline";
    }
    return targetUser?.id ? "online" : "offline";
  } catch {
    return "online";
  }
};

const formatMessageText = (text) => {
  if (!text) return [];

  const segments = [];
  const regex = /(\bhttps?:\/\/\S+|\bwww\.\S+)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        value: text.slice(lastIndex, match.index),
      });
    }

    const rawUrl = match[1];
    const normalizedUrl = rawUrl.startsWith("http")
      ? rawUrl
      : `https://${rawUrl}`;
    segments.push({ type: "link", value: normalizedUrl, text: rawUrl });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return segments;
};

const StreamChatExperience = ({
  chatClient,
  channel,
  handleVideoCall,
  currentUser,
  targetUser,
  isDarkMode,
}) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [userStatus, setUserStatus] = useState(null);
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [activeActionMenuId, setActiveActionMenuId] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(null);
  const [attachedFile, setAttachedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [threadMessageId, setThreadMessageId] = useState(null);
  const [threadDraft, setThreadDraft] = useState("");
  const [pinnedMessageIds, setPinnedMessageIds] = useState([]);
  const [quotedMessageId, setQuotedMessageId] = useState(null);
  const messageEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const longPressTimeoutRef = useRef(null);
  const longPressTrackerRef = useRef({ pointerId: null, moved: false });
  const displayedUserStatus =
    userStatus ?? getInitialUserStatus(chatClient, targetUser);

  // Clean up pointer listeners on unmount
  useEffect(() => {
    return () => {
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
      }
    };
  }, []);

  // Fetch messages
  useEffect(() => {
    if (!chatClient || !channel) return undefined;

    const loadMessages = async () => {
      try {
        const messageResponse = await channel.query({
          messages: { limit: 100 },
        });
        setMessages(messageResponse.messages || []);
      } catch (error) {
        console.error("Error loading messages:", error);
      }
    };

    loadMessages();

    // Subscribe to new messages
    const handleMessageNew = (event) => {
      try {
        if (event?.message) {
          setMessages((prev) => [...prev, event.message]);
        }
      } catch (error) {
        console.error("Error handling new message:", error);
      }
    };

    const handleMessageUpdated = (event) => {
      try {
        if (event?.message?.id) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === event.message.id ? event.message : msg,
            ),
          );
        }
      } catch (error) {
        console.error("Error handling message update:", error);
      }
    };

    const handleTyping = (event) => {
      try {
        if (event?.user?.id && event.user.id !== currentUser?._id) {
          setIsTyping(true);
          setTimeout(() => setIsTyping(false), 3000);
        }
      } catch (error) {
        console.warn("Error handling typing indicator:", error);
      }
    };

    // User presence events
    const handleUserPresence = (event) => {
      try {
        if (event?.user?.id === targetUser?.id) {
          setUserStatus(event.user.online ? "online" : "offline");
        }
      } catch (error) {
        console.warn("Error handling user presence:", error);
      }
    };

    channel.on("message.new", handleMessageNew);
    channel.on("message.updated", handleMessageUpdated);
    channel.on("typing.start", handleTyping);
    chatClient.on("user.presence.changed", handleUserPresence);

    return () => {
      channel.off("message.new", handleMessageNew);
      channel.off("message.updated", handleMessageUpdated);
      channel.off("typing.start", handleTyping);
      chatClient.off("user.presence.changed", handleUserPresence);
    };
  }, [channel, currentUser?._id, chatClient, targetUser?.id]);

  // Auto scroll to bottom
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!chatClient || !channel) return null;

  const handleSendMessage = async (text) => {
    if (!text.trim()) return;

    try {
      const messageData = { text };

      // Add quoted message if replying
      if (quotedMessageId) {
        const quotedMsg = messages.find((m) => m.id === quotedMessageId);
        if (quotedMsg) {
          messageData.quoted_message_id = quotedMessageId;
          messageData.quoted_message = {
            id: quotedMsg.id,
            text: quotedMsg.text,
            user: quotedMsg.user,
          };
        }
        setQuotedMessageId(null);
      }

      await channel.sendMessage(messageData);
      setInputMessage("");
      setIsTyping(false);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    }
  };

  const handleAddReaction = async (messageId, emoji) => {
    try {
      const reactionType = getTypeForEmoji(emoji);
      await channel.sendReaction(messageId, { type: reactionType });

      // Update message immediately in state
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === messageId) {
            const counts = msg.reaction_counts || {};
            return {
              ...msg,
              reaction_counts: {
                ...counts,
                [reactionType]: (counts[reactionType] || 0) + 1,
              },
            };
          }
          return msg;
        }),
      );
      setShowEmojiPicker(null);
    } catch (error) {
      console.error("Error adding reaction:", error);
      toast.error("Failed to add reaction");
    }
  };

  const handleRemoveReaction = async (messageId, reactionType) => {
    try {
      await channel.deleteReaction(messageId, reactionType);

      // Update message immediately in state
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === messageId) {
            const counts = msg.reaction_counts || {};
            const newCount = (counts[reactionType] || 1) - 1;
            const newCounts = { ...counts };
            if (newCount <= 0) {
              delete newCounts[reactionType];
            } else {
              newCounts[reactionType] = newCount;
            }
            return {
              ...msg,
              reaction_counts: newCounts,
            };
          }
          return msg;
        }),
      );
    } catch (error) {
      console.error("Error removing reaction:", error);
      toast.error("Failed to remove reaction");
    }
  };

  const handleTypingIndicator = () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    channel.keystroke();
    typingTimeoutRef.current = setTimeout(() => {
      channel.stopTyping();
    }, 1000);
  };

  const handleEditMessage = async (messageId) => {
    const trimmed = editDraft.trim();
    if (!trimmed) return;

    try {
      await channel.updateMessage({ id: messageId, text: trimmed });
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, text: trimmed } : msg,
        ),
      );
      setEditingMessageId(null);
      setEditDraft("");
      toast.success("Message updated");
    } catch (error) {
      console.error("Error editing message:", error);
      toast.error("Failed to edit message");
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      await channel.deleteMessage(messageId);
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      toast.success("Message deleted");
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error("Failed to delete message");
    }
  };

  const handlePinMessage = async (messageId) => {
    try {
      const isPinned = pinnedMessageIds.includes(messageId);
      if (isPinned) {
        if (channel?.unpinMessage) {
          await channel.unpinMessage(messageId);
        }
        setPinnedMessageIds((prev) => prev.filter((id) => id !== messageId));
        toast.success("Message unpinned");
      } else {
        if (channel?.pinMessage) {
          await channel.pinMessage(messageId);
        }
        setPinnedMessageIds((prev) =>
          prev.includes(messageId) ? prev : [...prev, messageId],
        );
        toast.success("Message pinned");
      }
    } catch (error) {
      console.error("Error toggling pin state:", error);
      toast.error("Failed to update pin state");
    }
  };

  const handleThreadReply = async (messageId) => {
    const trimmed = threadDraft.trim();
    if (!trimmed) return;

    try {
      await channel.sendMessage({
        text: trimmed,
        parent_id: messageId,
        show_in_thread: true,
      });
      setThreadDraft("");
      setThreadMessageId(null);
      toast.success("Thread reply sent");
    } catch (error) {
      console.error("Error sending thread reply:", error);
      toast.error("Failed to send thread reply");
    }
  };

  const startVideoCall = () => {
    // Send video call link instead of showing overlay
    handleVideoCall?.();
  };

  const startVoiceCall = () => {
    // Send voice call link
    if (channel) {
      const callUrl = `${window.location.origin}/call/${channel.id}?type=voice`;
      channel.sendMessage({
        text: `☎️ I started a voice call. Join here: ${callUrl}`,
      });
      toast.success("Voice call link sent!");
    }
  };

  const handleAttachFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file size (max 20MB)
      if (file.size > 20 * 1024 * 1024) {
        toast.error("File size must be less than 20MB");
        return;
      }

      setAttachedFile({
        file,
        name: file.name,
        size: file.size,
        type: file.type,
      });
      toast.success(`File "${file.name}" attached!`);
    }
  };

  const handleSendWithAttachment = async () => {
    if (!attachedFile) return;

    setIsUploading(true);
    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append("file", attachedFile.file);

      // Upload to Stream Chat
      const uploadResponse = await channel.sendFile(
        attachedFile.file,
        attachedFile.name,
      );

      // Send message with attachment
      await channel.sendMessage({
        text: `📎 ${attachedFile.name}`,
        attachments: [
          {
            type: "file",
            url: uploadResponse.file,
            title: attachedFile.name,
            mime_type: attachedFile.type,
            file_size: attachedFile.size,
          },
        ],
      });

      setAttachedFile(null);
      setInputMessage("");
      toast.success("File sent successfully!");
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  const removeAttachedFile = () => {
    setAttachedFile(null);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString([], {
        month: "short",
        day: "numeric",
      });
    }
  };

  // Long-press message handling for mobile touch devices
  const LONG_PRESS_DURATION = 500; // ms
  const LONG_PRESS_TOLERANCE = 10; // px movement tolerance

  const handleMessagePointerDown = (e, messageId) => {
    // Only handle on touch or pointer devices, not mouse
    if (e.pointerType === "mouse") return;

    longPressTrackerRef.current = {
      pointerId: e.pointerId,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
    };

    // Set timeout for long-press detection
    longPressTimeoutRef.current = setTimeout(() => {
      if (
        !longPressTrackerRef.current.moved &&
        longPressTrackerRef.current.pointerId === e.pointerId
      ) {
        setActiveActionMenuId(messageId);
      }
    }, LONG_PRESS_DURATION);
  };

  const handleMessagePointerMove = (e) => {
    if (longPressTrackerRef.current.pointerId !== e.pointerId) return;

    const dx = Math.abs(e.clientX - longPressTrackerRef.current.startX);
    const dy = Math.abs(e.clientY - longPressTrackerRef.current.startY);

    if (dx > LONG_PRESS_TOLERANCE || dy > LONG_PRESS_TOLERANCE) {
      longPressTrackerRef.current.moved = true;
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
        longPressTimeoutRef.current = null;
      }
    }
  };

  const handleMessagePointerUp = (e) => {
    if (longPressTrackerRef.current.pointerId === e.pointerId) {
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
        longPressTimeoutRef.current = null;
      }
      longPressTrackerRef.current = { pointerId: null, moved: false };
    }
  };

  let lastDate = null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-950">
      {/* Header */}
      <div
        className={`border-b ${
          isDarkMode
            ? "border-slate-800 bg-slate-900"
            : "border-gray-200 bg-white"
        } sticky top-0 z-30 shrink-0 px-6 py-4`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <UserAvatar
                src={targetUser?.image}
                name={targetUser?.name}
                userId={targetUser?.id}
                alt=""
                className="size-12"
              />
              <div
                className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-slate-900 ${
                  displayedUserStatus === "online"
                    ? "bg-green-500"
                    : "bg-slate-500"
                }`}
              />
            </div>
            <div>
              <h2 className="font-semibold text-slate-100">
                {targetUser?.name}
              </h2>
              <p className="text-xs text-slate-400">
                {displayedUserStatus === "online" ? "Online" : "Offline"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={startVoiceCall}
              className="rounded-lg bg-slate-800 p-2.5 hover:bg-slate-700 transition text-slate-300"
              title="Voice call"
            >
              <Phone size={18} />
            </button>
            <button
              onClick={startVideoCall}
              className="rounded-lg bg-slate-800 p-2.5 hover:bg-slate-700 transition text-slate-300"
              title="Video call"
            >
              <Video size={18} />
            </button>
            <button
              className="rounded-lg bg-slate-800 p-2.5 hover:bg-slate-700 transition text-slate-300"
              title="More options"
            >
              <MoreVertical size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto space-y-3 p-6"
        onMouseLeave={() => setHoveredMessageId(null)}
      >
        {messages?.map((msg, idx) => {
          if (!msg || !msg.id || !msg.user) return null;

          const prevMsg = idx > 0 ? messages[idx - 1] : null;
          const isConsecutive = prevMsg && prevMsg?.user?.id === msg?.user?.id;
          const isSent = msg?.user?.id === currentUser?._id;
          const currentMsgDate = formatDate(msg?.created_at);
          const showDateSeparator = !lastDate || lastDate !== currentMsgDate;
          lastDate = currentMsgDate;

          return (
            <div key={msg.id}>
              {showDateSeparator && (
                <div className="flex items-center justify-center gap-3 py-2">
                  <div className="h-px flex-1 bg-slate-800" />
                  <span className="text-xs text-slate-500">
                    {currentMsgDate}
                  </span>
                  <div className="h-px flex-1 bg-slate-800" />
                </div>
              )}

              <div
                className={`flex gap-3 group ${
                  isSent ? "justify-end" : "justify-start"
                } ${!isConsecutive ? "mt-4" : ""}`}
                onMouseEnter={() => setHoveredMessageId(msg.id)}
                onPointerDown={(e) => handleMessagePointerDown(e, msg.id)}
                onPointerMove={handleMessagePointerMove}
                onPointerUp={handleMessagePointerUp}
              >
                {!isSent && !isConsecutive && (
                  <UserAvatar
                    src={msg?.user?.image}
                    name={msg?.user?.name}
                    userId={msg?.user?.id}
                    alt=""
                    className="mt-0.5 size-8"
                  />
                )}
                {!isSent && isConsecutive && (
                  <div className="w-8 flex-shrink-0" />
                )}

                <div className="flex flex-col gap-1">
                  {editingMessageId === msg.id ? (
                    <div className="max-w-sm rounded-lg border border-slate-700 bg-slate-800 p-3">
                      <textarea
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none"
                      />
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          onClick={() => handleEditMessage(msg.id)}
                          className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm text-white"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingMessageId(null);
                            setEditDraft("");
                          }}
                          className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm text-slate-200"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`max-w-sm px-4 py-2.5 rounded-lg transition ${
                        isSent
                          ? "bg-purple-600 text-white rounded-br-none"
                          : "bg-slate-800 text-slate-100 rounded-bl-none"
                      }`}
                    >
                      {msg.story_id && (
                        <StoryReplyPreview
                          storyMediaUrl={msg.story_media_url}
                          storyMediaType={msg.story_media_type}
                          storyText={msg.story_text}
                          storyOwnerName={msg.story_owner_name || "User"}
                          isDark={true}
                        />
                      )}
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                        {formatMessageText(msg.text).map((segment, index) =>
                          segment.type === "link" ? (
                            <a
                              key={`${segment.value}-${index}`}
                              href={segment.value}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 font-semibold text-blue-200 underline decoration-blue-300/80 underline-offset-2 break-all transition hover:bg-white/20 hover:text-blue-100"
                            >
                              <Phone size={12} className="shrink-0" />
                              <span>{segment.text}</span>
                            </a>
                          ) : (
                            <span key={`text-${index}`}>{segment.value}</span>
                          ),
                        )}
                      </p>
                    </div>
                  )}

                  {pinnedMessageIds.includes(msg.id) && (
                    <div className="flex items-center gap-1 text-xs text-amber-400">
                      <Pin size={12} />
                      Pinned
                    </div>
                  )}

                  {/* Reactions Display */}
                  {msg.reaction_counts &&
                    Object.keys(msg.reaction_counts).length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-1">
                        {Object.entries(msg.reaction_counts).map(
                          ([reactionType, count]) => (
                            <button
                              key={reactionType}
                              onClick={() =>
                                handleRemoveReaction(msg.id, reactionType)
                              }
                              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 transition"
                            >
                              <span>{getEmojiForType(reactionType)}</span>
                              <span>{count}</span>
                            </button>
                          ),
                        )}
                      </div>
                    )}

                  <div
                    className={`flex items-center gap-1.5 px-1 text-xs text-slate-500`}
                  >
                    <span>{formatTime(msg.created_at)}</span>
                    {isSent && (
                      <CheckCheck size={14} className="text-blue-400" />
                    )}
                  </div>
                </div>

                {/* Compact message action menu */}
                {(hoveredMessageId === msg.id ||
                  editingMessageId === msg.id ||
                  activeActionMenuId === msg.id) && (
                  <div className="relative self-start pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveActionMenuId((prev) =>
                          prev === msg.id ? null : msg.id,
                        )
                      }
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900/90 text-slate-300 shadow-sm transition hover:bg-slate-800 hover:text-white"
                      title="More actions"
                    >
                      <MoreVertical size={14} />
                    </button>

                    {activeActionMenuId === msg.id && (
                      <div className="absolute right-0 top-8 z-40 min-w-[150px] rounded-xl border border-slate-700 bg-slate-900 p-1.5 shadow-xl">
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setShowEmojiPicker(
                                showEmojiPicker === msg.id ? null : msg.id,
                              );
                            }}
                            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-slate-200 transition hover:bg-slate-800"
                          >
                            <Smile size={12} />
                            React
                          </button>

                          {isSent && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveActionMenuId(null);
                                  setEditingMessageId(msg.id);
                                  setEditDraft(msg.text || "");
                                }}
                                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-slate-200 transition hover:bg-slate-800"
                              >
                                <Pencil size={12} />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveActionMenuId(null);
                                  handleDeleteMessage(msg.id);
                                }}
                                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-slate-200 transition hover:bg-slate-800"
                              >
                                <Trash2 size={12} />
                                Delete
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setActiveActionMenuId(null);
                              handlePinMessage(msg.id);
                            }}
                            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] transition ${
                              pinnedMessageIds.includes(msg.id)
                                ? "bg-amber-600/20 text-amber-400"
                                : "text-slate-200 hover:bg-slate-800"
                            }`}
                          >
                            <Pin size={12} />
                            {pinnedMessageIds.includes(msg.id)
                              ? "Unpin"
                              : "Pin"}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveActionMenuId(null);
                              setQuotedMessageId(msg.id);
                            }}
                            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-slate-200 transition hover:bg-slate-800"
                          >
                            <Reply size={12} />
                            Reply
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveActionMenuId(null);
                              setThreadMessageId(msg.id);
                              setThreadDraft("");
                            }}
                            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-slate-200 transition hover:bg-slate-800"
                          >
                            <Reply size={12} />
                            Thread
                          </button>
                        </div>

                        {showEmojiPicker === msg.id && (
                          <div className="mt-2 flex flex-wrap gap-1 border-t border-slate-800 pt-2">
                            {EMOJI_REACTIONS.map(({ emoji, type }) => (
                              <button
                                key={type}
                                type="button"
                                onClick={() => handleAddReaction(msg.id, emoji)}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-sm transition hover:bg-slate-800"
                              >
                                {emoji}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => setShowEmojiPicker(null)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="flex gap-3 justify-start">
            <UserAvatar
              src={targetUser?.image}
              name={targetUser?.name}
              userId={targetUser?.id}
              alt=""
              className="mt-0.5 size-8"
            />
            <div className="bg-slate-800 text-slate-100 px-4 py-2.5 rounded-lg rounded-bl-none">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-current rounded-full animate-pulse" />
                <div
                  className="w-2 h-2 bg-current rounded-full animate-pulse"
                  style={{ animationDelay: "0.2s" }}
                />
                <div
                  className="w-2 h-2 bg-current rounded-full animate-pulse"
                  style={{ animationDelay: "0.4s" }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={messageEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-800 bg-slate-900 p-4">
        {/* Attached File Preview */}
        {attachedFile && (
          <div className="mb-3 p-3 bg-slate-800 rounded-lg border border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Paperclip size={16} className="text-purple-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 truncate">
                  {attachedFile.name}
                </p>
                <p className="text-xs text-slate-400">
                  {(attachedFile.size / 1024).toFixed(2)} KB
                </p>
              </div>
            </div>
            <button
              onClick={removeAttachedFile}
              className="p-1 hover:bg-slate-700 rounded transition text-slate-400 flex-shrink-0"
              title="Remove file"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {threadMessageId && (
          <div className="mb-3 rounded-xl border border-slate-700 bg-slate-800 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-200">Thread reply</p>
              <button
                onClick={() => {
                  setThreadMessageId(null);
                  setThreadDraft("");
                }}
                className="text-sm text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
            </div>
            <textarea
              value={threadDraft}
              onChange={(e) => setThreadDraft(e.target.value)}
              rows={2}
              placeholder="Write a thread reply..."
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none"
            />
            <div className="mt-2 flex items-center justify-end gap-2">
              <button
                onClick={() => handleThreadReply(threadMessageId)}
                className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm text-white"
              >
                Send reply
              </button>
            </div>
          </div>
        )}

        {quotedMessageId && (
          <div className="mb-3 rounded-lg border-l-3 border-slate-600 bg-slate-800/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-300">
                Replying to{" "}
                {messages.find((m) => m.id === quotedMessageId)?.user?.name ||
                  "User"}
              </p>
              <button
                onClick={() => setQuotedMessageId(null)}
                className="text-slate-400 hover:text-slate-200"
                title="Cancel reply"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-slate-400 truncate">
              {messages.find((m) => m.id === quotedMessageId)?.text || ""}
            </p>
          </div>
        )}

        <div className="flex gap-3 items-end">
          <div className="flex gap-2">
            <button
              onClick={handleAttachFile}
              disabled={isUploading}
              className="p-2.5 rounded-lg hover:bg-slate-800 transition text-slate-400 disabled:opacity-50"
              title="Attach file"
            >
              <Paperclip size={18} />
            </button>
            <button
              className="p-2.5 rounded-lg hover:bg-slate-800 transition text-slate-400 cursor-not-allowed opacity-50"
              title="Emoji (Coming soon)"
              disabled
            >
              <Smile size={18} />
            </button>
          </div>

          <input
            type="text"
            placeholder="Type a message..."
            value={inputMessage}
            onChange={(e) => {
              setInputMessage(e.target.value);
              handleTypingIndicator();
            }}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                (inputMessage.trim() || attachedFile)
              ) {
                if (attachedFile) {
                  handleSendWithAttachment();
                } else if (inputMessage.trim()) {
                  handleSendMessage(inputMessage);
                }
              }
            }}
            className="flex-1 px-4 py-3 rounded-lg outline-none transition border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 focus:border-purple-500 resize-none max-h-24"
            disabled={isUploading}
          />

          <button
            onClick={() => {
              if (attachedFile) {
                handleSendWithAttachment();
              } else if (inputMessage.trim()) {
                handleSendMessage(inputMessage);
              }
            }}
            disabled={(!inputMessage.trim() && !attachedFile) || isUploading}
            className={`p-2.5 rounded-lg transition flex-shrink-0 ${
              (inputMessage.trim() || attachedFile) && !isUploading
                ? "bg-purple-600 hover:bg-purple-700 text-white"
                : "bg-gray-600 text-gray-400 cursor-not-allowed"
            }`}
            title={isUploading ? "Uploading..." : "Send message"}
          >
            {isUploading ? (
              <div className="w-4 h-4 border-2 border-gray-400 border-t-white rounded-full animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          accept="*/*"
        />
      </div>
    </div>
  );
};

export default StreamChatExperience;
