import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Clipboard,
  Copy,
  Link as LinkIcon,
  Plus,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import { createCommunity, getMyCommunities } from "../lib/api.js";

const getError = (error) =>
  error?.response?.data?.message || "Unable to complete that action";

const CommunityAvatar = ({ community }) => (
  <div className="avatar shrink-0">
    <div className="size-14 rounded-xl bg-primary/15 text-primary">
      {community.avatar ? (
        <img src={community.avatar} alt={community.name} />
      ) : (
        <span className="flex size-full items-center justify-center text-xl font-bold">
          {community.name?.charAt(0).toUpperCase() || "C"}
        </span>
      )}
    </div>
  </div>
);

const CommunitiesPage = () => {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [createdInvite, setCreatedInvite] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    avatar: "",
    category: "",
    rules: "",
    privacy: "private",
  });
  const communitiesQuery = useQuery({
    queryKey: ["communities"],
    queryFn: getMyCommunities,
  });
  const createMutation = useMutation({
    mutationFn: createCommunity,
    onSuccess: ({ inviteToken }) => {
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      setForm({
        name: "",
        description: "",
        avatar: "",
        category: "",
        rules: "",
        privacy: "private",
      });
      setCreatedInvite(`${window.location.origin}/group/${inviteToken}`);
      setShowCreate(false);
      toast.success("Community created");
    },
    onError: (error) => toast.error(getError(error)),
  });

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(createdInvite);
      toast.success("Invite link copied");
    } catch {
      toast.error("Could not copy the invite link");
    }
  };

  const communities = communitiesQuery.data?.communities || [];
  return (
    <div className="w-full overflow-y-auto bg-base-100 px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-base-300 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              Connect
            </p>
            <h1 className="mt-1 text-3xl font-bold">Communities</h1>
            <p className="mt-2 text-sm opacity-60">
              Manage your groups and create public spaces people can discover.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowCreate((visible) => !visible)}
          >
            <Plus className="size-4" /> Create community
          </button>
        </header>

        {createdInvite && (
          <div className="alert alert-success flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Your community invite is ready</p>
              <p className="break-all text-sm opacity-80">{createdInvite}</p>
            </div>
            <button type="button" className="btn btn-sm" onClick={copyInvite}>
              <Copy className="size-4" /> Copy link
            </button>
          </div>
        )}

        {showCreate && (
          <form
            className="rounded-xl border border-base-300 bg-base-200 p-5 shadow-sm sm:p-7"
            onSubmit={(event) => {
              event.preventDefault();
              createMutation.mutate(form);
            }}
          >
            <div className="mb-5 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UsersRound className="size-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Create a community</h2>
                <p className="text-sm opacity-60">
                    Choose invite-only private access or public discovery in Explore.
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="form-control">
                <span className="label-text mb-2 font-semibold">Name</span>
                <input
                  className="input input-bordered"
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  minLength={2}
                  maxLength={80}
                  required
                />
              </label>
              <label className="form-control">
                <span className="label-text mb-2 font-semibold">Category</span>
                <input
                  className="input input-bordered"
                  value={form.category}
                  onChange={(event) =>
                    setForm({ ...form, category: event.target.value })
                  }
                  maxLength={50}
                  placeholder="Language exchange"
                />
              </label>
              <label className="form-control">
                <span className="label-text mb-2 font-semibold">Visibility</span>
                <select
                  className="select select-bordered"
                  value={form.privacy}
                  onChange={(event) =>
                    setForm({ ...form, privacy: event.target.value })
                  }
                >
                  <option value="private">Private · invite link only</option>
                  <option value="public">Public · discoverable in Explore</option>
                </select>
              </label>
              <label className="form-control md:col-span-2">
                <span className="label-text mb-2 font-semibold">
                  Description
                </span>
                <textarea
                  className="textarea textarea-bordered"
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                  maxLength={500}
                />
              </label>
              <label className="form-control">
                <span className="label-text mb-2 font-semibold">
                  Avatar URL
                </span>
                <input
                  type="url"
                  className="input input-bordered"
                  value={form.avatar}
                  onChange={(event) =>
                    setForm({ ...form, avatar: event.target.value })
                  }
                />
              </label>
              <label className="form-control">
                <span className="label-text mb-2 font-semibold">Rules</span>
                <input
                  className="input input-bordered"
                  value={form.rules}
                  onChange={(event) =>
                    setForm({ ...form, rules: event.target.value })
                  }
                  maxLength={1000}
                  placeholder="Be kind and stay on topic"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Creating..." : "Create community"}
              </button>
            </div>
          </form>
        )}

        {communitiesQuery.isLoading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : communities.length === 0 ? (
          <div className="rounded-xl border border-dashed border-base-300 p-12 text-center">
            <UsersRound className="mx-auto mb-3 size-9 opacity-40" />
            <h2 className="font-semibold">No communities yet</h2>
            <p className="mt-2 text-sm opacity-60">
              Create one or join a private community using an invite link.
            </p>
          </div>
        ) : (
          <section className="grid gap-4 sm:grid-cols-2">
            {communities.map((community) => (
              <article
                key={community._id}
                className="rounded-xl border border-base-300 bg-base-200 p-5 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <CommunityAvatar community={community} />
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold">
                      {community.name}
                    </h2>
                    <p className="text-xs opacity-60">
                      {community.memberCount || 0} member
                      {community.memberCount === 1 ? "" : "s"}
                      {community.category ? ` · ${community.category}` : ""}
                    </p>
                  </div>
                </div>
                <p className="mt-4 line-clamp-2 text-sm opacity-70">
                  {community.description || "Private HyeChat community"}
                </p>
                <Link
                  to={`/communities/${community._id}`}
                  className="btn btn-outline mt-5 w-full"
                >
                  <LinkIcon className="size-4" /> Open community
                </Link>
              </article>
            ))}
          </section>
        )}
      </div>
    </div>
  );
};

export default CommunitiesPage;
