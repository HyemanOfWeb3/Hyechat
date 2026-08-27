import {
  Copy,
  Link2,
  LogOut,
  Settings2,
  Shield,
  UsersRound,
  X,
} from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { CommunityAvatar } from "./CommunityChatHeader.jsx";

const CommunityInfoDrawer = ({
  community,
  isOpen,
  onClose,
  canManageMembers,
  isOwner,
  inviteLink,
  inviteMutation,
  revokeMutation,
  memberMutation,
  leaveMutation,
  onLeave,
  updateMutation,
  transferMutation,
  deleteMutation,
  onTransfer,
  onDelete,
  isMuted,
  onToggleMute,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [draft, setDraft] = useState({
    name: community.name,
    description: community.description || "",
    avatar: community.avatar || "",
  });

  if (!isOpen) return null;

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success("Invite link copied");
    } catch {
      toast.error("Could not copy the invite link");
    }
  };

  return (
    <div
      className="community-drawer-layer fixed inset-0 z-40"
      role="dialog"
      aria-modal="true"
      aria-label="Community information"
    >
      <button
        type="button"
        className="community-drawer-backdrop absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-label="Close community information"
      />
      <aside className="community-info-drawer absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-base-100 shadow-2xl sm:w-[380px]">
        <div className="flex items-center justify-between border-b border-base-300/70 px-5 py-4">
          <h2 className="text-lg font-bold">Community info</h2>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-square"
            onClick={onClose}
            aria-label="Close community information"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
          <section className="flex flex-col items-center text-center">
            <CommunityAvatar community={community} size="size-20" />
            {isEditing ? (
              <div className="mt-3 w-full space-y-2">
                <input
                  className="input input-bordered input-sm w-full"
                  value={draft.name}
                  onChange={(event) =>
                    setDraft({ ...draft, name: event.target.value })
                  }
                  maxLength={80}
                  aria-label="Community name"
                />
                <textarea
                  className="textarea textarea-bordered textarea-sm w-full"
                  value={draft.description}
                  onChange={(event) =>
                    setDraft({ ...draft, description: event.target.value })
                  }
                  maxLength={500}
                  aria-label="Community description"
                />
                <input
                  className="input input-bordered input-sm w-full"
                  type="url"
                  value={draft.avatar}
                  onChange={(event) =>
                    setDraft({ ...draft, avatar: event.target.value })
                  }
                  aria-label="Community avatar URL"
                />
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      updateMutation.mutate(draft);
                      setIsEditing(false);
                    }}
                    disabled={updateMutation.isPending}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <h3 className="mt-3 text-xl font-bold">{community.name}</h3>
            )}
            <p className="mt-1 max-w-xs text-sm opacity-60">
              {community.description || "Private HyeChat community"}
            </p>
            {community.rules && (
              <p className="mt-3 max-w-xs text-xs opacity-50">
                {community.rules}
              </p>
            )}
          </section>

          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider opacity-60">
                Members
              </h3>
              <span className="text-sm opacity-60">
                {community.members?.length || 0}
              </span>
            </div>
            <div className="space-y-1">
              <input
                className="input input-bordered input-sm mb-2 w-full"
                placeholder="Search members"
                value={memberQuery}
                onChange={(event) => setMemberQuery(event.target.value)}
                aria-label="Search members"
              />
              {community.members?.map((member) => {
                const user = member.user;
                const userId = user?._id || user;
                const isMemberOwner = member.role === "owner";
                if (
                  memberQuery &&
                  !user?.fullName
                    ?.toLowerCase()
                    .includes(memberQuery.toLowerCase())
                )
                  return null;
                return (
                  <div
                    key={userId}
                    className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-base-200"
                  >
                    <div className="avatar shrink-0">
                      <div className="size-9 rounded-full bg-base-300">
                        {user?.profilePic ? (
                          <img src={user.profilePic} alt={user.fullName} />
                        ) : (
                          <span className="flex size-full items-center justify-center text-sm font-bold">
                            {user?.fullName?.charAt(0) || "U"}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {user?.fullName || "Member"}
                      </p>
                      <p className="text-xs opacity-55">{member.role}</p>
                    </div>
                    {isOwner && !isMemberOwner && (
                      <select
                        className="select select-bordered select-xs w-24"
                        value={member.role}
                        onChange={(event) =>
                          memberMutation.mutate({
                            userId,
                            role: event.target.value,
                          })
                        }
                        disabled={memberMutation.isPending}
                        aria-label={`Change role for ${user?.fullName || "member"}`}
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}
                    {isOwner && !isMemberOwner && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={() => onTransfer(userId)}
                        disabled={transferMutation.isPending}
                      >
                        Transfer
                      </button>
                    )}
                    {canManageMembers && !isMemberOwner && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-error"
                        onClick={() => memberMutation.mutate({ userId })}
                        disabled={memberMutation.isPending}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {canManageMembers && (
            <section className="mt-8 border-t border-base-300/70 pt-6">
              <div className="mb-3 flex items-center gap-2">
                <Link2 className="size-4 text-primary" />
                <h3 className="text-sm font-bold uppercase tracking-wider opacity-60">
                  Invite members
                </h3>
              </div>
              {inviteLink && (
                <div className="rounded-xl bg-base-200 p-3">
                  <p className="break-all text-xs opacity-60">{inviteLink}</p>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm mt-2"
                    onClick={copyInvite}
                  >
                    <Copy className="size-4" /> Copy link
                  </button>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => inviteMutation.mutate(community._id)}
                  disabled={inviteMutation.isPending}
                >
                  <Link2 className="size-4" />{" "}
                  {inviteLink ? "Regenerate" : "Generate link"}
                </button>
                {inviteLink && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm text-error"
                    onClick={() => revokeMutation.mutate(community._id)}
                    disabled={revokeMutation.isPending}
                  >
                    Revoke
                  </button>
                )}
              </div>
            </section>
          )}

          <section className="mt-8 border-t border-base-300/70 pt-6">
            <h3 className="text-sm font-bold uppercase tracking-wider opacity-60">
              Community actions
            </h3>
            {canManageMembers && (
              <button
                type="button"
                className="btn btn-ghost mt-2 w-full justify-start"
              >
                <Shield className="size-4" /> Manage members
              </button>
            )}
            {canManageMembers && (
              <button
                type="button"
                className="btn btn-ghost w-full justify-start"
                onClick={() => setIsEditing(true)}
              >
                <Settings2 className="size-4" /> Community settings
              </button>
            )}
            {isOwner && (
              <>
                <button
                  type="button"
                  className="btn btn-ghost mt-2 w-full justify-start text-error"
                  onClick={onDelete}
                  disabled={deleteMutation.isPending}
                >
                  <LogOut className="size-4" /> Delete community
                </button>
              </>
            )}
            <button
              type="button"
              className="btn btn-ghost mt-2 w-full justify-start"
              onClick={onToggleMute}
            >
              <UsersRound className="size-4" />{" "}
              {isMuted ? "Unmute notifications" : "Mute notifications"}
            </button>
            <button
              type="button"
              className="btn btn-ghost mt-2 w-full justify-start text-error"
              onClick={onLeave}
              disabled={leaveMutation.isPending || isOwner}
            >
              <LogOut className="size-4" />{" "}
              {isOwner ? "Owner cannot leave" : "Leave community"}
            </button>
          </section>
        </div>
      </aside>
    </div>
  );
};

export default CommunityInfoDrawer;
