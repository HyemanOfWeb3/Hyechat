import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  lazy,
  Suspense,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { getStreamToken, getUserFriends } from "../lib/api.js";
import useAuthUser from "../hooks/useAuthUser.js";
import { StreamChat } from "stream-chat";
import toast from "react-hot-toast";
import {
  Search,
  Send,
  MoreVertical,
  Phone,
  Video,
  Image as ImageIcon,
  Paperclip,
  Smile,
  Mic,
  Check,
  CheckCheck,
  MessageSquare,
  Users,
  Sparkles,
  Settings,
  Bell,
  Moon,
  Sun,
  ChevronLeft,
  Info,
  LogOut,
  UserPlus,
  Shield,
  Trash2,
  Folder,
  Link2,
  Volume2,
  Plus,
  X,
  FileText,
  Download,
  CheckCircle2,
  Camera,
  CornerUpLeft,
  Copy,
  MicOff,
  VideoOff,
  PhoneOff,
  ScreenShare,
  Maximize2,
  Menu,
} from "lucide-react";
import ChatLoader from "../components/ChatLoader.jsx";

const StreamChatExperience = lazy(
  () => import("../components/StreamChatExperience.jsx"),
);

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

const INITIAL_CHATS = [
  {
    id: "ai-1",
    name: "Aether AI Companion",
    avatar:
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=150&q=80",
    status: "online",
    isAI: true,
    unreadCount: 0,
    messages: [
      {
        id: "m1",
        text: "Hello! I am Aether, your built-in AI companion. Ask me anything!",
        sender: "them",
        timestamp: "9:00 AM",
        read: true,
        reactions: {},
      },
    ],
    bio: "AI Assistant powered by advanced language models",
    mutualFriends: 0,
    media: [],
    members: [],
  },
];

const INITIAL_STORIES = [
  {
    id: "s1",
    name: "My Story",
    avatar:
      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80",
    storyImg: null,
    active: false,
    self: true,
  },
];

// Story Viewer Modal
function StoryViewerModal({ story, onClose, stories }) {
  const [currentIndex, setCurrentIndex] = useState(
    stories.findIndex((s) => s.id === story.id),
  );
  const [progress, setProgress] = useState(0);
  const progressInterval = useRef(null);

  const handleNext = useCallback(() => {
    setProgress(0);
    setCurrentIndex((index) => {
      if (index < stories.length - 1) return index + 1;
      onClose();
      return index;
    });
  }, [onClose, stories.length]);

  const handlePrev = useCallback(() => {
    setProgress(0);
    setCurrentIndex((index) => Math.max(index - 1, 0));
  }, []);

  useEffect(() => {
    progressInterval.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          handleNext();
          return 0;
        }
        return prev + 2;
      });
    }, 50);
    return () => clearInterval(progressInterval.current);
  }, [currentIndex, handleNext]);

  const currentStory = stories[currentIndex];

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center">
      <div className="relative w-full max-w-md h-full md:h-[600px] bg-black rounded-lg overflow-hidden">
        <div className="absolute top-0 left-0 right-0 flex gap-1 p-2 z-20">
          {stories.map((_, idx) => (
            <div
              key={idx}
              className="flex-1 h-0.5 bg-slate-600 rounded-full overflow-hidden"
            >
              <div
                className="h-full bg-white transition-all"
                style={{
                  width:
                    idx === currentIndex
                      ? `${progress}%`
                      : idx < currentIndex
                        ? "100%"
                        : "0%",
                }}
              />
            </div>
          ))}
        </div>

        <img
          src={currentStory.storyImg}
          alt={currentStory.name}
          className="w-full h-full object-cover"
        />

        <div className="absolute top-8 left-0 right-0 px-4 z-10">
          <div className="flex items-center gap-3">
            <img
              src={currentStory.avatar}
              alt={currentStory.name}
              className="w-10 h-10 rounded-full"
            />
            <div className="flex-1">
              <p className="font-semibold text-white">{currentStory.name}</p>
              <p className="text-xs text-gray-300">2 minutes ago</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <button
          onClick={handlePrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-2 hover:bg-white/20 rounded-full transition z-10"
        >
          <ChevronLeft size={24} />
        </button>
        <button
          onClick={handleNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-white/20 rounded-full transition z-10"
        >
          <ChevronLeft size={24} className="rotate-180" />
        </button>
      </div>
    </div>
  );
}

// Settings Modal
function SettingsModal({ isOpen, onClose, user, setUser }) {
  const [displayName, setDisplayName] = useState(user.name);
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    user.notificationsEnabled,
  );
  const [soundEnabled, setSoundEnabled] = useState(user.soundEnabled);
  const [activeStatus, setActiveStatus] = useState(user.activeStatus);
  const fileInputRef = useRef(null);

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUser((prev) => ({
          ...prev,
          avatar: event.target.result,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    setUser((prev) => ({
      ...prev,
      name: displayName,
      notificationsEnabled,
      soundEnabled,
      activeStatus,
    }));
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-800 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6">
          <div className="flex flex-col items-center">
            <img
              src={user.avatar}
              alt={user.name}
              className="w-20 h-20 rounded-full mb-3 object-cover"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition text-sm font-medium"
            >
              <Camera size={16} className="inline mr-2" />
              Change Avatar
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Online Status
            </label>
            <select
              value={activeStatus}
              onChange={(e) => setActiveStatus(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
            >
              <option value="online">Online</option>
              <option value="away">Away</option>
              <option value="offline">Offline</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Notifications</label>
            <button
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              className={`relative w-12 h-6 rounded-full transition ${
                notificationsEnabled ? "bg-purple-600" : "bg-slate-700"
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  notificationsEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Notification Sound</label>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`relative w-12 h-6 rounded-full transition ${
                soundEnabled ? "bg-purple-600" : "bg-slate-700"
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  soundEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="w-full mt-6 bg-purple-600 hover:bg-purple-700 rounded-lg py-2 font-medium transition"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const { authUser, isLoading: authLoading } = useAuthUser();
  const { data: friendsData = [], isLoading: friendsLoading } = useQuery({
    queryKey: ["friends"],
    queryFn: getUserFriends,
    enabled: !!authUser,
  });

  const { data: tokenData, isLoading: tokenLoading } = useQuery({
    queryKey: ["streamToken"],
    queryFn: getStreamToken,
    enabled: !!authUser,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const [chatClient, setChatClient] = useState(null);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [aiChat, setAiChat] = useState(INITIAL_CHATS[0]);
  const [stories, setStories] = useState(INITIAL_STORIES);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [selectedStory, setSelectedStory] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [user, setUser] = useState({
    name: authUser?.fullName || "You",
    avatar:
      authUser?.profilePic ||
      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80",
    activeStatus: "online",
    notificationsEnabled: true,
    soundEnabled: true,
  });
  const messageEndRef = useRef(null);

  // Initialize Stream Chat Client
  useEffect(() => {
    const initStreamChat = async () => {
      if (authLoading || tokenLoading || !authUser || !tokenData?.token) return;

      try {
        const client = StreamChat.getInstance(STREAM_API_KEY);
        await client.connectUser(
          {
            id: authUser._id,
            name: authUser.fullName,
            image: authUser.profilePic,
          },
          tokenData.token,
        );
        setChatClient(client);
      } catch (error) {
        console.error("Error initializing Stream Chat:", error);
        toast.error("Failed to connect to chat service");
      }
    };

    initStreamChat();
  }, [authLoading, tokenLoading, authUser, tokenData]);

  const chats = useMemo(
    () => [
      aiChat,
      ...friendsData.map((friend) => ({
        id: friend._id,
        name: friend.fullName,
        avatar: friend.profilePic,
        status: friend.isOnline ? "online" : "offline",
        isAI: false,
        unreadCount: 0,
        messages: [],
        bio: friend.bio || "No bio",
        mutualFriends: 0,
        media: [],
        members: [],
      })),
    ],
    [aiChat, friendsData],
  );

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats, isTyping]);

  const handleSelectChat = async (chat) => {
    setSelectedChatId(chat.id);
    setSidebarOpen(false);

    if (chatClient && chat.id !== "ai-1") {
      try {
        const channelId = [authUser._id, chat.id].sort().join("-");
        const channel = chatClient.channel("messaging", channelId, {
          members: [authUser._id, chat.id],
          name: `Conversation with ${chat.name}`,
        });
        await channel.watch();
        setSelectedChannel(channel);
      } catch (error) {
        console.error("Error selecting chat:", error);
        toast.error("Failed to load chat");
      }
    } else {
      setSelectedChannel(null);
    }
  };

  const handleVideoCall = () => {
    if (selectedChannel) {
      const callUrl = `${window.location.origin}/call/${selectedChannel.id}`;
      selectedChannel.sendMessage({
        text: `I started a video call. Join here: ${callUrl}`,
      });
      toast.success("Video call link sent successfully!");
    }
  };

  const handleAIResponse = (userMsg) => {
    setAiChat((chat) => ({
      ...chat,
      messages: [
        ...chat.messages,
        {
          id: `m-${Date.now()}`,
          text: userMsg,
          sender: "me",
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          read: true,
          reactions: {},
        },
      ],
    }));

    setIsTyping(true);

    setTimeout(() => {
      const aiResponses = [
        "That's an interesting point! Let me think about that...",
        "Great question! Here's what I'd suggest...",
        "I completely agree with you on that.",
        "That's a clever approach! Have you considered...",
        "Absolutely! Let me help you with that.",
      ];

      const randomResponse =
        aiResponses[Math.floor(Math.random() * aiResponses.length)];

      setAiChat((chat) => ({
        ...chat,
        messages: [
          ...chat.messages,
          {
            id: `ai-${Date.now()}`,
            text: randomResponse,
            sender: "them",
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            read: true,
            reactions: {},
          },
        ],
      }));
      setIsTyping(false);
    }, 1500);
  };

  const handleSendMessage = async (message) => {
    if (!message.trim()) return;

    const activeChat = chats.find((c) => c.id === selectedChatId) || chats[0];

    if (activeChat.id === "ai-1") {
      handleAIResponse(message);
    } else if (selectedChannel && chatClient) {
      try {
        await selectedChannel.sendMessage({ text: message });
        setInputMessage("");
      } catch (error) {
        console.error("Error sending message:", error);
        toast.error("Failed to send message");
      }
    }
  };

  const handleStoryUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const newStory = {
          id: `s-${Date.now()}`,
          name: "My Story",
          avatar: user.avatar,
          storyImg: event.target.result,
          active: true,
          self: true,
        };
        setStories((prev) => [prev[0], newStory, ...prev.slice(1)]);
      };
      reader.readAsDataURL(file);
    }
  };

  const filteredChats = chats.filter((chat) => {
    const matchesSearch = chat.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    switch (categoryFilter) {
      case "unread":
        return chat.unreadCount > 0 && matchesSearch;
      case "groups":
        return chat.isGroup && matchesSearch;
      case "ai":
        return chat.isAI && matchesSearch;
      default:
        return matchesSearch;
    }
  });

  const activeChat = chats.find((c) => c.id === selectedChatId) || chats[0];

  if (authLoading || tokenLoading || friendsLoading) {
    return <ChatLoader />;
  }

  // If we have a Stream Chat client and a selected channel for a friend
  if (selectedChannel && activeChat.id !== "ai-1") {
    return (
      <div className="h-screen w-full flex bg-slate-950 text-slate-100">
        <button
          onClick={() => {
            setSelectedChatId(null);
            setSelectedChannel(null);
            setSidebarOpen(true);
          }}
          className="absolute top-4 left-4 p-2 rounded-lg z-30 md:hidden hover:bg-slate-800"
        >
          <ChevronLeft size={20} />
        </button>
        <Suspense fallback={<ChatLoader />}>
          <StreamChatExperience
            key={selectedChannel.id}
            chatClient={chatClient}
            channel={selectedChannel}
            handleVideoCall={handleVideoCall}
          />
        </Suspense>
      </div>
    );
  }

  // Main UI with sidebar and chat preview
  return (
    <div
      className={`h-screen w-full flex overflow-hidden transition-colors ${
        darkMode ? "bg-slate-950 text-slate-100" : "bg-gray-50 text-gray-900"
      }`}
    >
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? "w-64" : "w-0"
        } transition-all duration-300 border-r ${
          darkMode
            ? "border-slate-800 bg-slate-900"
            : "border-gray-200 bg-white"
        } overflow-y-auto flex flex-col md:relative absolute md:z-0 z-40 h-full shadow-lg`}
      >
        {/* Header */}
        <div
          className={`p-4 border-b ${
            darkMode
              ? "border-slate-800 bg-slate-900"
              : "border-gray-200 bg-white"
          } sticky top-0`}
        >
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Sparkles size={20} className="text-purple-500" />
              HyeChat
            </h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className={`p-1 rounded-lg transition md:hidden ${
                darkMode ? "hover:bg-slate-800" : "hover:bg-gray-100"
              }`}
            >
              <X size={20} />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-3 opacity-50" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none transition border ${
                darkMode
                  ? "bg-slate-800 border-slate-700 focus:border-purple-500"
                  : "bg-gray-100 border-gray-300 focus:border-purple-500"
              }`}
            />
          </div>
        </div>

        {/* Stories */}
        <div
          className={`px-4 py-3 border-b ${
            darkMode ? "border-slate-800" : "border-gray-200"
          } overflow-x-auto`}
        >
          <div className="flex gap-3">
            <label className="relative cursor-pointer group flex-shrink-0">
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center border-2 transition ${
                  darkMode
                    ? "border-slate-700 bg-slate-800 group-hover:border-purple-500"
                    : "border-gray-300 bg-gray-100 group-hover:border-purple-500"
                }`}
              >
                <Plus size={20} className="text-purple-500" />
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleStoryUpload}
                className="hidden"
              />
            </label>

            {stories.slice(1).map((story) => (
              <button
                key={story.id}
                onClick={() => {
                  setSelectedStory(story);
                  setStoryViewerOpen(true);
                }}
                className={`w-14 h-14 rounded-full flex-shrink-0 border-2 overflow-hidden transition ${
                  story.active
                    ? "border-purple-500"
                    : darkMode
                      ? "border-slate-700"
                      : "border-gray-300"
                }`}
              >
                <img
                  src={story.avatar}
                  alt={story.name}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex gap-2 px-4 py-3 overflow-x-auto">
          {[
            { id: "all", label: "All" },
            { id: "unread", label: "Unread" },
            { id: "ai", label: "AI" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap transition ${
                categoryFilter === cat.id
                  ? "bg-purple-600 text-white"
                  : darkMode
                    ? "bg-slate-800 hover:bg-slate-700"
                    : "bg-gray-200 hover:bg-gray-300"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {filteredChats.length === 0 ? (
            <div className="p-4 text-center opacity-50">
              <MessageSquare size={24} className="mx-auto mb-2" />
              <p className="text-sm">No chats found</p>
            </div>
          ) : (
            <div
              className={`divide-y ${
                darkMode ? "divide-slate-800" : "divide-gray-200"
              }`}
            >
              {filteredChats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => handleSelectChat(chat)}
                  className={`w-full p-4 text-left transition group ${
                    selectedChatId === chat.id
                      ? darkMode
                        ? "bg-purple-600"
                        : "bg-purple-100"
                      : darkMode
                        ? "hover:bg-slate-800"
                        : "hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      <img
                        src={chat.avatar}
                        alt={chat.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                      {chat.status === "online" && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-current" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium truncate">{chat.name}</p>
                        {chat.unreadCount > 0 && (
                          <span className="ml-2 bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full flex-shrink-0">
                            {chat.unreadCount}
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-xs truncate ${
                          darkMode ? "opacity-70" : "opacity-60"
                        }`}
                      >
                        {chat.messages[chat.messages.length - 1]?.text ||
                          "No messages"}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div
          className={`p-4 border-t ${
            darkMode ? "border-slate-800" : "border-gray-200"
          } space-y-2`}
        >
          <div className="flex gap-2">
            <button
              onClick={() => setSettingsOpen(true)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition ${
                darkMode ? "hover:bg-slate-800" : "hover:bg-gray-100"
              }`}
            >
              <Settings size={18} />
              <span className="text-sm">Settings</span>
            </button>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition ${
                darkMode ? "hover:bg-slate-800" : "hover:bg-gray-100"
              }`}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              <span className="text-sm">Theme</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative">
        <button
          onClick={() => setSidebarOpen(true)}
          className={`absolute top-4 left-4 p-2 rounded-lg z-30 md:hidden ${
            darkMode ? "hover:bg-slate-800" : "hover:bg-gray-100"
          }`}
        >
          <Menu size={20} />
        </button>

        {/* Chat Header */}
        <div
          className={`p-4 border-b ${
            darkMode
              ? "border-slate-800 bg-slate-900/50"
              : "border-gray-200 bg-white/50"
          } backdrop-blur-sm`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={activeChat.avatar}
                alt={activeChat.name}
                className="w-12 h-12 rounded-full object-cover"
              />
              <div>
                <h1 className="font-bold">{activeChat.name}</h1>
                <p
                  className={`text-xs ${
                    darkMode ? "opacity-70" : "opacity-60"
                  }`}
                >
                  {activeChat.status === "online" ? (
                    <span className="text-green-500">● Online</span>
                  ) : activeChat.status === "away" ? (
                    <span className="text-yellow-500">● Away</span>
                  ) : (
                    <span className="opacity-50">● Offline</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {!activeChat.isAI && (
                <>
                  <button
                    className={`p-2 rounded-lg transition ${
                      darkMode ? "hover:bg-slate-800" : "hover:bg-gray-100"
                    }`}
                  >
                    <Phone size={18} />
                  </button>
                  <button
                    onClick={handleVideoCall}
                    className={`p-2 rounded-lg transition ${
                      darkMode ? "hover:bg-slate-800" : "hover:bg-gray-100"
                    }`}
                  >
                    <Video size={18} />
                  </button>
                </>
              )}
              <button
                className={`p-2 rounded-lg transition ${
                  darkMode ? "hover:bg-slate-800" : "hover:bg-gray-100"
                }`}
              >
                <MoreVertical size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div
          className={`flex-1 overflow-y-auto p-6 space-y-3 ${
            darkMode ? "bg-slate-950" : "bg-gray-50"
          }`}
        >
          {activeChat.messages.map((m, idx) => {
            const prevMsg = idx > 0 ? activeChat.messages[idx - 1] : null;
            const isConsecutive = prevMsg && prevMsg.sender === m.sender;
            const isSent = m.sender === "me";

            return (
              <div
                key={m.id}
                className={`flex gap-3 ${
                  isSent ? "justify-end" : "justify-start"
                } ${!isConsecutive ? "mt-6" : ""}`}
              >
                {!isSent && !isConsecutive && (
                  <img
                    src={activeChat.avatar}
                    alt={activeChat.name}
                    className="w-8 h-8 rounded-full flex-shrink-0 mt-0.5"
                  />
                )}
                {!isSent && isConsecutive && (
                  <div className="w-8 flex-shrink-0" />
                )}

                <div className="flex flex-col gap-1">
                  <div
                    className={`max-w-sm px-4 py-2.5 rounded-lg transition ${
                      isSent
                        ? "bg-purple-600 text-white rounded-br-none"
                        : darkMode
                          ? "bg-slate-800 text-slate-100 rounded-bl-none"
                          : "bg-gray-200 text-gray-900 rounded-bl-none"
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {m.text}
                    </p>
                  </div>
                  <div
                    className={`flex items-center gap-1.5 px-1 text-xs ${
                      isSent ? "justify-end" : "justify-start"
                    } ${darkMode ? "text-slate-500" : "text-gray-500"}`}
                  >
                    <span>{m.timestamp}</span>
                    {isSent &&
                      (m.read ? (
                        <CheckCheck size={14} className="text-blue-400" />
                      ) : (
                        <Check size={14} className="opacity-70" />
                      ))}
                  </div>
                </div>
              </div>
            );
          })}
          {isTyping && (
            <div className="flex gap-3 justify-start">
              <img
                src={activeChat.avatar}
                alt={activeChat.name}
                className="w-8 h-8 rounded-full flex-shrink-0 mt-0.5"
              />
              <div
                className={`px-4 py-2.5 rounded-lg ${
                  darkMode ? "bg-slate-800" : "bg-gray-200"
                } rounded-bl-none`}
              >
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
        <div
          className={`p-4 border-t ${
            darkMode
              ? "border-slate-800 bg-slate-900"
              : "border-gray-200 bg-white"
          }`}
        >
          <div className="flex gap-3 items-end">
            <div className="flex gap-2">
              <button
                className={`p-2.5 rounded-lg transition ${
                  darkMode ? "hover:bg-slate-800" : "hover:bg-gray-100"
                }`}
                title="Attach file"
              >
                <Paperclip
                  size={18}
                  className={darkMode ? "text-slate-400" : "text-gray-500"}
                />
              </button>
              <button
                className={`p-2.5 rounded-lg transition ${
                  darkMode ? "hover:bg-slate-800" : "hover:bg-gray-100"
                }`}
                title="Emoji"
              >
                <Smile
                  size={18}
                  className={darkMode ? "text-slate-400" : "text-gray-500"}
                />
              </button>
            </div>

            <input
              type="text"
              placeholder={
                activeChat.isAI ? "Ask Aether anything..." : "Type a message..."
              }
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && inputMessage.trim()) {
                  handleSendMessage(inputMessage);
                  setInputMessage("");
                }
              }}
              className={`flex-1 px-4 py-3 rounded-lg outline-none transition border resize-none max-h-24 ${
                darkMode
                  ? "bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500 focus:border-purple-500"
                  : "bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-500 focus:border-purple-500"
              }`}
            />

            <button
              onClick={() => {
                if (inputMessage.trim()) {
                  handleSendMessage(inputMessage);
                  setInputMessage("");
                }
              }}
              disabled={!inputMessage.trim()}
              className={`p-2.5 rounded-lg transition flex-shrink-0 ${
                inputMessage.trim()
                  ? "bg-purple-600 hover:bg-purple-700 text-white"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
              title="Send message"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Story Viewer Modal */}
      {storyViewerOpen && selectedStory && (
        <StoryViewerModal
          story={selectedStory}
          stories={stories.filter((s) => s.storyImg)}
          onClose={() => {
            setStoryViewerOpen(false);
            setSelectedStory(null);
          }}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        user={user}
        setUser={setUser}
      />
    </div>
  );
}
