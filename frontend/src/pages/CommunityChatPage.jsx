import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Chat,
  Channel,
  MessageComposer,
  MessageList,
  Thread,
  Window,
  useChannelActionContext,
} from "stream-chat-react";
import useStreamClient from "../hooks/useStreamClient.js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCommunity,
  deleteCommunity,
  leaveCommunity,
  regenerateCommunityInvite,
  removeCommunityMember,
  revokeCommunityInvite,
  setCommunityMemberRole,
  transferCommunityOwnership,
  updateCommunity,
} from "../lib/api.js";
import useAuthUser from "../hooks/useAuthUser.js";
import ChatLoader from "../components/ChatLoader.jsx";
import CommunityChatHeader from "../components/CommunityChatHeader.jsx";
import CommunityInfoDrawer from "../components/CommunityInfoDrawer.jsx";
import { useThemeStore } from "../store/useThemeStore.js";

const CommunitySearchResults = ({ results, onSelect }) => {
  const { jumpToMessage } = useChannelActionContext();

  const openMessage = async (messageId) => {
    try {
      await jumpToMessage(messageId);
      onSelect();
    } catch (error) {
      console.error("Could not open searched community message:", error);
      toast.error("Could not open that message. Try again.");
    }
  };

  return (
    <div className="mt-2 flex max-h-32 flex-col gap-1 overflow-y-auto">
      {results.map((message) => (
        <button
          key={message.id}
          type="button"
          onClick={() => void openMessage(message.id)}
          className="min-h-11 truncate rounded-lg px-2 py-1 text-left text-sm hover:bg-base-300/60"
        >
          <span className="font-semibold">
            {message.user?.name || "Member"}
          </span>
          <span className="ml-2 opacity-70">
            {message.text || "Attachment"}
          </span>
        </button>
      ))}
    </div>
  );
};

const CommunityChatPage = () => {
  const { id } = useParams();
  const { authUser } = useAuthUser();
  const queryClient = useQueryClient();
  const { theme } = useThemeStore();
  const [client, setClient] = useState(null);
  const [channel, setChannel] = useState(null);
  const [error, setError] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const { data: communityData, isLoading: communityLoading } = useQuery({
    queryKey: ["community", id],
    queryFn: () => getCommunity(id),
    enabled: Boolean(id),
  });

  // Use persistent shared Stream client
  const { client: streamClient, connectionState } = useStreamClient();

  const community = communityData?.community;
  const currentMember = community?.members?.find(
    (member) => (member.user?._id || member.user)?.toString() === authUser?._id,
  );
  const isOwner = community?.owner?.toString() === authUser?._id;
  const canManageMembers = isOwner || currentMember?.role === "admin";

  const invalidateCommunity = () =>
    queryClient.invalidateQueries({ queryKey: ["community", id] });
  const navigateAwayFromCommunity = () => {
    window.location.assign("/communities");
  };
  const inviteMutation = useMutation({
    mutationFn: regenerateCommunityInvite,
    onSuccess: ({ inviteToken }) => {
      setInviteLink(`${window.location.origin}/group/${inviteToken}`);
      toast.success("Invite link regenerated");
    },
    onError: (mutationError) =>
      toast.error(
        mutationError.response?.data?.message || "Unable to regenerate invite",
      ),
  });
  const revokeMutation = useMutation({
    mutationFn: revokeCommunityInvite,
    onSuccess: () => {
      setInviteLink("");
      toast.success("Invite link revoked");
    },
    onError: (mutationError) =>
      toast.error(
        mutationError.response?.data?.message || "Unable to revoke invite",
      ),
  });
  const leaveMutation = useMutation({
    mutationFn: leaveCommunity,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      toast.success("You left the community");
      navigateAwayFromCommunity();
    },
    onError: (mutationError) =>
      toast.error(
        mutationError.response?.data?.message || "Unable to leave community",
      ),
  });
  const memberMutation = useMutation({
    mutationFn: ({ userId, role }) =>
      role
        ? setCommunityMemberRole(id, userId, role)
        : removeCommunityMember(id, userId),
    onSuccess: () => {
      invalidateCommunity();
      toast.success("Member settings updated");
    },
    onError: (mutationError) =>
      toast.error(
        mutationError.response?.data?.message || "Unable to update member",
      ),
  });
  const updateMutation = useMutation({
    mutationFn: (data) => updateCommunity(id, data),
    onSuccess: () => {
      invalidateCommunity();
      toast.success("Community updated");
    },
    onError: (mutationError) =>
      toast.error(
        mutationError.response?.data?.message || "Unable to update community",
      ),
  });
  const transferMutation = useMutation({
    mutationFn: (userId) => transferCommunityOwnership(id, userId),
    onSuccess: () => {
      invalidateCommunity();
      toast.success("Ownership transferred");
    },
    onError: (mutationError) =>
      toast.error(
        mutationError.response?.data?.message || "Unable to transfer ownership",
      ),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteCommunity,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      toast.success("Community deleted");
      navigateAwayFromCommunity();
    },
    onError: (mutationError) =>
      toast.error(
        mutationError.response?.data?.message || "Unable to delete community",
      ),
  });

  useEffect(() => {
    if (
      !authUser ||
      !communityData?.community ||
      !streamClient ||
      connectionState !== "connected"
    )
      return undefined;
    let active = true;
    const connect = async () => {
      try {
        const streamChannel = streamClient.channel(
          "messaging",
          communityData.community.streamChannelId,
        );
        await streamChannel.watch();
        if (active) {
          setClient(streamClient);
          setChannel(streamChannel);
        }
      } catch (connectionError) {
        console.error("Could not open community chat", connectionError);
        if (active) setError("Unable to open this community chat.");
      }
    };
    connect();
    return () => {
      active = false;
    };
  }, [authUser, communityData, streamClient, connectionState]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query || !client || !channel) {
      return undefined;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await client.search({ cid: channel.cid }, query, {
          limit: 20,
        });
        if (active) setSearchResults(response.messages || []);
      } catch (searchError) {
        console.error("Could not search community messages", searchError);
        if (active) setSearchResults([]);
      } finally {
        if (active) setIsSearching(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [channel, client, searchQuery]);

  if (communityLoading) return <ChatLoader />;
  if (error || !communityData?.community)
    return (
      <div className="flex w-full items-center justify-center p-8">
        <p className="text-error">{error || "Community not found."}</p>
      </div>
    );
  if (!client || !channel) return <ChatLoader />;

  return (
    <div className="community-chat flex h-full min-h-0 w-full flex-col bg-base-100">
      <CommunityChatHeader
        community={community}
        onOpenInfo={() => setIsInfoOpen(true)}
        isSearchOpen={isSearchOpen}
        searchQuery={searchQuery}
        onSearchToggle={() => {
          setIsSearchOpen((open) => !open);
          setSearchQuery("");
        }}
        onSearchChange={setSearchQuery}
      />
      <div className="community-chat-stream relative min-h-0 flex-1">
        <Chat
          client={client}
          theme={
            theme === "dark" || theme === "forest"
              ? "str-chat__theme-dark"
              : "str-chat__theme-light"
          }
        >
          <Channel channel={channel}>
            {isSearchOpen && searchQuery.trim() && (
              <div className="absolute inset-x-3 top-3 z-30 max-h-56 overflow-y-auto rounded-xl border border-base-300 bg-base-100/95 p-3 shadow-xl backdrop-blur sm:inset-x-5">
                <p className="text-xs opacity-60">
                  {isSearching
                    ? "Searching messages..."
                    : `${searchResults.length} results`}
                </p>
                {!isSearching && searchResults.length > 0 ? (
                  <CommunitySearchResults
                    results={searchResults}
                    onSelect={() => {
                      setSearchQuery("");
                      setIsSearchOpen(false);
                    }}
                  />
                ) : !isSearching ? (
                  <p className="py-3 text-sm opacity-65">
                    No matching messages found.
                  </p>
                ) : null}
              </div>
            )}
            <Window>
              <MessageList
                messageActions={[
                  "edit",
                  "delete",
                  "reply",
                  "quote",
                  "react",
                  "pin",
                  "saveForLater",
                ]}
              />
              <MessageComposer />
            </Window>
            <Thread
              messageActions={[
                "edit",
                "delete",
                "reply",
                "quote",
                "react",
                "pin",
                "saveForLater",
              ]}
            />
          </Channel>
        </Chat>
      </div>
      <CommunityInfoDrawer
        community={community}
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
        canManageMembers={canManageMembers}
        isOwner={isOwner}
        inviteLink={inviteLink}
        inviteMutation={inviteMutation}
        revokeMutation={revokeMutation}
        memberMutation={memberMutation}
        leaveMutation={leaveMutation}
        updateMutation={updateMutation}
        transferMutation={transferMutation}
        deleteMutation={deleteMutation}
        onTransfer={(userId) => {
          if (window.confirm("Transfer ownership to this member?"))
            transferMutation.mutate(userId);
        }}
        onDelete={() => {
          if (
            window.confirm(
              `Delete ${community.name}? This permanently removes the community and its invite configuration.`,
            )
          )
            deleteMutation.mutate(id);
        }}
        isMuted={isMuted}
        onToggleMute={async () => {
          try {
            if (isMuted) await channel.unmute();
            else await channel.mute();
            setIsMuted((muted) => !muted);
            toast.success(isMuted ? "Community unmuted" : "Community muted");
          } catch {
            toast.error("Unable to change community notifications");
          }
        }}
        onLeave={() => {
          if (window.confirm("Leave this community?")) leaveMutation.mutate(id);
        }}
      />
    </div>
  );
};

export default CommunityChatPage;
