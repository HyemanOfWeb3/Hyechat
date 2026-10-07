import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  Link2,
  MapPin,
  MessageCircle,
  ShieldBan,
  UserPlus,
  Users,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import useAuthUser from "../hooks/useAuthUser.js";
import {
  acceptFriendRequest,
  blockUser,
  cancelFriendRequest,
  declineFriendRequest,
  getPublicUserProfile,
  removeFriend,
  sendFriendRequest,
  unblockUser,
} from "../lib/api.js";

const relationshipLabel = (status) => {
  if (status === "friends") return "Friends";
  if (status === "pending_outgoing") return "Request sent";
  if (status === "pending_incoming") return "Request received";
  if (status === "blocked") return "Blocked";
  return "";
};

const copyToClipboard = async (value) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("Clipboard is unavailable");
};

const UserProfilePage = () => {
  const { userId = "" } = useParams();
  const navigate = useNavigate();
  const { authUser } = useAuthUser();
  const queryClient = useQueryClient();
  const profileQuery = useQuery({
    queryKey: ["userProfile", userId],
    queryFn: () => getPublicUserProfile(userId),
    enabled: Boolean(userId),
    retry: false,
  });
  const profile = profileQuery.data?.profile;
  const relationship = profile?.relationship || {};
  const isSelf = relationship.status === "self" || profile?._id === authUser?._id;
  const isBlocked = relationship.status === "blocked";

  const refreshRelationshipData = () => {
    queryClient.invalidateQueries({ queryKey: ["userProfile", userId] });
    queryClient.invalidateQueries({ queryKey: ["friendsPage"] });
    queryClient.invalidateQueries({ queryKey: ["friends"] });
    queryClient.invalidateQueries({ queryKey: ["userDiscovery"] });
    queryClient.invalidateQueries({ queryKey: ["users"] });
    queryClient.invalidateQueries({ queryKey: ["relationshipRequests"] });
    queryClient.invalidateQueries({ queryKey: ["outgoingFriendReqs"] });
    queryClient.invalidateQueries({ queryKey: ["incomingFriendRequestCount"] });
    queryClient.invalidateQueries({ queryKey: ["blockedUsers"] });
  };

  const relationshipMutation = useMutation({
    mutationFn: ({ action, id, requestId }) => {
      if (action === "connect") return sendFriendRequest(id);
      if (action === "accept") return acceptFriendRequest(requestId);
      if (action === "decline") return declineFriendRequest(requestId);
      if (action === "cancel") return cancelFriendRequest(requestId);
      if (action === "remove") return removeFriend(id);
      if (action === "unblock") return unblockUser(id);
      return blockUser(id);
    },
    onSuccess: (_result, { action }) => {
      refreshRelationshipData();
      const messages = {
        connect: "Friend request sent",
        accept: "Friend request accepted",
        decline: "Friend request declined",
        cancel: "Friend request cancelled",
        remove: "Friend removed",
        block: "User blocked",
        unblock: "User unblocked",
      };
      toast.success(messages[action] || "Profile relationship updated");
    },
    onError: (error) =>
      toast.error(error.response?.data?.message || "Unable to update this relationship"),
  });

  const shareProfile = async () => {
    const profileUrl = new URL(
      `/profile/${encodeURIComponent(userId)}`,
      window.location.origin,
    ).toString();
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${profile.fullName} on HyeChat`,
          text: `View ${profile.fullName}'s HyeChat profile`,
          url: profileUrl,
        });
      } else {
        await copyToClipboard(profileUrl);
        toast.success("Profile link copied");
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        toast.error("Unable to share this profile");
      }
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/explore");
  };

  const runRelationshipAction = (action, options = {}) => {
    if (["block", "remove"].includes(action)) {
      const prompt = action === "block"
        ? `Block ${profile.fullName}? They will no longer be able to interact with you.`
        : `Remove ${profile.fullName} from your friends?`;
      if (!window.confirm(prompt)) return;
    }
    relationshipMutation.mutate({
      action,
      id: userId,
      requestId: options.requestId || relationship.requestId,
    });
  };

  if (profileQuery.isLoading) {
    return (
      <div className="flex w-full items-center justify-center py-20" role="status">
        <span className="loading loading-spinner loading-lg text-primary" />
        <span className="sr-only">Loading profile</span>
      </div>
    );
  }

  if (!profile || profileQuery.isError) {
    const notFound = profileQuery.error?.response?.status === 404;
    return (
      <div className="w-full overflow-y-auto bg-base-100 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-2xl">
          <button type="button" className="btn btn-ghost btn-sm mb-6" onClick={handleBack}>
            <ArrowLeft className="size-4" /> Back
          </button>
          <div className="rounded-2xl border border-base-300 bg-base-200 p-8 text-center">
            <Users className="mx-auto mb-3 size-9 opacity-40" />
            <h1 className="text-xl font-bold">
              {notFound ? "Profile unavailable" : "Couldn't load this profile"}
            </h1>
            <p className="mt-2 text-sm opacity-60">
              {notFound
                ? "This profile may not exist or may be unavailable due to privacy or blocking."
                : "Check your connection and try again."}
            </p>
            {!notFound && (
              <button type="button" className="btn btn-outline btn-sm mt-4" onClick={() => profileQuery.refetch()}>
                Try again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const hasLanguages = Boolean(profile.nativeLanguage || profile.learningLanguage);
  const canInteract = !isSelf && !isBlocked;

  return (
    <div className="w-full flex-1 overflow-y-auto bg-base-100 px-4 py-5 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-8 lg:px-10">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-center justify-between gap-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleBack}>
            <ArrowLeft className="size-4" /> Back
          </button>
          {isSelf && <Link to="/profile" className="btn btn-outline btn-sm">Edit profile</Link>}
        </div>

        <header className="overflow-hidden rounded-3xl border border-base-300 bg-base-200 shadow-sm">
          <div className="h-24 bg-gradient-to-r from-primary/25 via-secondary/15 to-accent/25 sm:h-32" />
          <div className="px-5 pb-5 sm:px-8 sm:pb-7">
            <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:items-end">
                <div className="avatar shrink-0">
                  <div className="size-24 overflow-hidden rounded-full border-4 border-base-200 bg-base-300 sm:size-28">
                    {profile.profilePic ? (
                      <img src={profile.profilePic} alt={`${profile.fullName}'s profile`} className="size-full object-cover" />
                    ) : (
                      <span className="flex size-full items-center justify-center text-3xl font-bold opacity-60">
                        {profile.fullName?.charAt(0)?.toUpperCase() || "U"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="min-w-0 pb-1">
                  <h1 className="break-words text-2xl font-bold sm:text-3xl">{profile.fullName || "HyeChat user"}</h1>
                  {profile.emailVerified && (
                    <span className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-info">
                      <BadgeCheck className="size-4" /> HyeChat email verified
                    </span>
                  )}
                  {profile.location && (
                    <p className="mt-2 flex items-center gap-1.5 text-sm opacity-60">
                      <MapPin className="size-4 shrink-0" /> {profile.location}
                    </p>
                  )}
                </div>
              </div>
              {relationshipLabel(relationship.status) && !isSelf && (
                <span className={`badge ${isBlocked ? "badge-error" : "badge-outline"} badge-lg self-start sm:self-auto`}>
                  {relationshipLabel(relationship.status)}
                </span>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {canInteract && (
                <Link to={`/chat/${encodeURIComponent(profile._id)}`} className="btn btn-primary min-h-11 flex-1 sm:flex-none">
                  <MessageCircle className="size-4" /> Message
                </Link>
              )}
              {!isSelf && !isBlocked && relationship.status === "none" && (
                <button type="button" className="btn btn-outline min-h-11 flex-1 sm:flex-none" onClick={() => runRelationshipAction("connect")} disabled={relationshipMutation.isPending}>
                  <UserPlus className="size-4" /> Connect
                </button>
              )}
              {!isSelf && relationship.status === "pending_outgoing" && (
                <button type="button" className="btn btn-outline min-h-11 flex-1 sm:flex-none" onClick={() => runRelationshipAction("cancel")} disabled={relationshipMutation.isPending}>
                  Cancel request
                </button>
              )}
              {!isSelf && relationship.status === "pending_incoming" && (
                <>
                  <button type="button" className="btn btn-primary min-h-11 flex-1 sm:flex-none" onClick={() => runRelationshipAction("accept")} disabled={relationshipMutation.isPending}>Accept request</button>
                  <button type="button" className="btn btn-outline min-h-11 flex-1 sm:flex-none" onClick={() => runRelationshipAction("decline")} disabled={relationshipMutation.isPending}>Decline</button>
                </>
              )}
              {!isSelf && relationship.status === "friends" && (
                <button type="button" className="btn btn-outline min-h-11 flex-1 sm:flex-none" onClick={() => runRelationshipAction("remove")} disabled={relationshipMutation.isPending}>Remove friend</button>
              )}
              {!isSelf && relationship.blockedByMe && (
                <button type="button" className="btn btn-outline min-h-11 flex-1 sm:flex-none" onClick={() => runRelationshipAction("unblock")} disabled={relationshipMutation.isPending}>Unblock</button>
              )}
              {!isSelf && !relationship.blockedByMe && (
                <button type="button" className="btn btn-ghost btn-square min-h-11 min-w-11" onClick={() => runRelationshipAction("block")} disabled={relationshipMutation.isPending} aria-label={`Block ${profile.fullName}`} title="Block user">
                  <ShieldBan className="size-4" />
                </button>
              )}
              <button type="button" className="btn btn-ghost min-h-11 flex-1 sm:flex-none" onClick={shareProfile}>
                <Link2 className="size-4" /> Share profile
              </button>
            </div>
            {isBlocked && relationship.blockedByMe && (
              <p className="mt-3 text-sm text-warning">You blocked this user. Unblock them to restore profile actions.</p>
            )}
          </div>
        </header>

        <section className="rounded-2xl border border-base-300 bg-base-200 p-5 sm:p-6" aria-labelledby="profile-about-heading">
          <h2 id="profile-about-heading" className="text-xs font-bold uppercase tracking-[0.16em] opacity-55">About</h2>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed sm:text-base">
            {profile.bio?.trim() || "No bio yet."}
          </p>
        </section>

        <section className="rounded-2xl border border-base-300 bg-base-200 p-5 sm:p-6" aria-labelledby="profile-languages-heading">
          <h2 id="profile-languages-heading" className="flex items-center gap-2 text-lg font-bold">
            <BookOpen className="size-5 text-primary" /> Languages
          </h2>
          {hasLanguages ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {profile.nativeLanguage && (
                <div className="rounded-xl bg-base-100 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-55">Speaks</p>
                  <p className="mt-1 font-semibold capitalize">{profile.nativeLanguage}</p>
                </div>
              )}
              {profile.learningLanguage && (
                <div className="rounded-xl bg-base-100 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-55">Learning</p>
                  <p className="mt-1 font-semibold capitalize">{profile.learningLanguage}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm opacity-60">No languages added yet.</p>
          )}
        </section>

        <section className="rounded-2xl border border-base-300 bg-base-200 p-5 sm:p-6" aria-labelledby="profile-interests-heading">
          <h2 id="profile-interests-heading" className="text-lg font-bold">Interests</h2>
          {profile.interests?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.interests.map((interest) => (
                <span key={interest} className="badge badge-primary badge-outline px-3 py-3">{interest}</span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm opacity-60">No interests added yet.</p>
          )}
        </section>
      </div>
    </div>
  );
};

export default UserProfilePage;
