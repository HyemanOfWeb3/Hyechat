import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { Link as LinkIcon, UsersRound } from "lucide-react";
import {
  getCommunityInvitePreview,
  joinCommunityByInvite,
} from "../lib/api.js";
import useAuthUser from "../hooks/useAuthUser.js";

const CommunityInvitePage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { authUser } = useAuthUser();
  const previewQuery = useQuery({
    queryKey: ["communityInvite", token],
    queryFn: () => getCommunityInvitePreview(token),
    enabled: Boolean(token),
    retry: false,
  });
  const joinMutation = useMutation({
    mutationFn: () => joinCommunityByInvite(token),
    onSuccess: ({ community }) => {
      toast.success("You joined the community");
      navigate(`/communities/${community._id}`);
    },
    onError: (error) =>
      toast.error(error.response?.data?.message || "Unable to join community"),
  });
  const community = previewQuery.data?.community;

  if (previewQuery.isLoading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  if (previewQuery.isError || !community)
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Invite link unavailable</h1>
          <p className="mt-2 text-sm opacity-60">
            This private community invite may be expired or revoked.
          </p>
          <Link
            to={authUser ? "/communities" : "/login"}
            className="btn btn-primary mt-5"
          >
            Continue
          </Link>
        </div>
      </div>
    );

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-100 p-6">
      <div className="w-full max-w-lg rounded-xl border border-base-300 bg-base-200 p-6 text-center shadow-lg sm:p-8">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          {community.avatar ? (
            <img
              src={community.avatar}
              alt={community.name}
              className="size-full rounded-2xl object-cover"
            />
          ) : (
            <UsersRound className="size-8" />
          )}
        </div>
        <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          Private invite
        </p>
        <h1 className="mt-2 text-3xl font-bold">{community.name}</h1>
        <p className="mt-3 text-sm opacity-70">
          {community.description || "A private HyeChat community"}
        </p>
        <p className="mt-4 text-xs opacity-60">
          {community.memberCount} members
          {community.category ? ` · ${community.category}` : ""}
        </p>
        {authUser ? (
          <button
            type="button"
            className="btn btn-primary mt-6 w-full"
            onClick={() => joinMutation.mutate()}
            disabled={joinMutation.isPending}
          >
            {joinMutation.isPending ? "Joining..." : "Join community"}
          </button>
        ) : (
          <Link
            to={`/login?redirect=/group/${token}`}
            className="btn btn-primary mt-6 w-full"
          >
            <LinkIcon className="size-4" /> Log in to join
          </Link>
        )}
        <Link to="/" className="btn btn-ghost btn-sm mt-2">
          Back to HyeChat
        </Link>
      </div>
    </div>
  );
};

export default CommunityInvitePage;
