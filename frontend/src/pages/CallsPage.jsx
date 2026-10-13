import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock3,
  Phone,
  Search,
  Trash2,
  Video,
} from "lucide-react";
import toast from "react-hot-toast";
import { deleteCallHistory, getCallHistory } from "../lib/api.js";
import useAuthUser from "../hooks/useAuthUser.js";
import UserProfileLink from "../components/UserProfileLink.jsx";
import UserAvatar from "../components/UserAvatar.jsx";

const formatDuration = (seconds) => {
  if (!seconds) return "—";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
};

const CallsPage = () => {
  const queryClient = useQueryClient();
  const { authUser } = useAuthUser();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const historyQuery = useQuery({
    queryKey: ["call-history", search, filter],
    queryFn: () =>
      getCallHistory({
        search,
        status: ["completed", "cancelled"].includes(filter)
          ? filter
          : undefined,
        callType: ["voice", "video"].includes(filter) ? filter : undefined,
      }),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteCallHistory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["call-history"] });
      toast.success("Call history deleted");
    },
    onError: () => toast.error("Unable to delete call history"),
  });
  const calls = historyQuery.data?.calls || [];

  return (
    <div className="h-full min-h-0 w-full overflow-y-auto overscroll-contain bg-base-100 px-4 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Phone className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Calls</h1>
            <p className="text-sm opacity-65">
              Your recent voice and video calls
            </p>
          </div>
        </div>
        <label className="input input-bordered mb-4 flex items-center gap-2">
          <Search className="size-4 opacity-60" />
          <input
            className="grow"
            type="search"
            placeholder="Search participants"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {[
            ["all", "All"],
            ["completed", "Completed"],
            ["cancelled", "Cancelled"],
            ["voice", "Voice"],
            ["video", "Video"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`btn btn-sm ${filter === value ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {historyQuery.isLoading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : !calls.length ? (
          <div className="rounded-xl border border-dashed border-base-300 p-12 text-center">
            <Clock3 className="mx-auto mb-3 size-8 opacity-40" />
            <h2 className="font-semibold">No call history yet</h2>
            <p className="mt-2 text-sm opacity-60">
              Completed calls will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-base-300 bg-base-200">
            {calls.map((call) => {
              const other = call.participants?.find(
                (user) => user._id !== authUser?._id,
              );
              const outgoing = call.caller?._id === authUser?._id;
              return (
                <div
                  key={call._id}
                  className="flex items-center gap-3 border-b border-base-300 px-4 py-4 last:border-0"
                >
                  <UserProfileLink
                    userId={other?._id}
                    className="shrink-0 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    aria-label={`View ${other?.fullName || "call participant"}'s profile`}
                  >
                    <UserAvatar
                      src={other?.profilePic}
                      name={other?.fullName}
                      userId={other?._id}
                      alt=""
                      className="size-11"
                    />
                  </UserProfileLink>
                  <div className="min-w-0 flex-1">
                    <UserProfileLink
                      userId={other?._id}
                      className="truncate font-semibold hover:text-primary"
                    >
                      {other?.fullName || "Call participant"}
                    </UserProfileLink>
                    <p className="flex min-w-0 flex-wrap items-center gap-x-1 text-sm opacity-65">
                      {outgoing ? (
                        <ArrowUpRight className="size-3.5" />
                      ) : (
                        <ArrowDownLeft className="size-3.5" />
                      )}
                      {call.callType === "video" ? (
                        <Video className="size-3.5" />
                      ) : (
                        <Phone className="size-3.5" />
                      )}
                      {call.status} ·{" "}
                      {new Date(call.createdAt).toLocaleString([], {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                  <span className="hidden text-sm opacity-65 sm:inline">
                    {formatDuration(call.duration)}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-square text-error"
                    onClick={() => {
                      if (window.confirm("Delete this call history entry?"))
                        deleteMutation.mutate(call._id);
                    }}
                    aria-label="Delete call history"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CallsPage;
