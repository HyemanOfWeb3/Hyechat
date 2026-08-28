import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import toast from "react-hot-toast";

import {
  getUserFriends,
  getRecommendedUsers,
  getOutgoingFriendReqs,
  sendFriendRequest,
} from "../lib/api.js";
import { Link } from "react-router-dom";
import {
  CheckCircleIcon,
  MapPinIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import FriendCard from "../components/FriendCard.jsx";
import NoFriendsFound from "../components/NoFriendsFound.jsx";
import { getLanguageFlag } from "../components/LanguageFlag.jsx";
import { capitalize } from "../lib/utils.js";

const HomePage = () => {
  const queryClient = useQueryClient();
  const [pendingUserId, setPendingUserId] = useState(null);

  const { data: friends = [], isLoading: loadingFriends } = useQuery({
    queryKey: ["friends"],
    queryFn: getUserFriends,
  });

  const { data: recommendedUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["users"],
    queryFn: getRecommendedUsers,
  });

  const { data: outgoingFriendReqs } = useQuery({
    queryKey: ["outgoingFriendReqs"],
    queryFn: getOutgoingFriendReqs,
  });

  const { mutate: sendRequestMutation } = useMutation({
    mutationFn: sendFriendRequest,
    onMutate: async (userId) => {
      setPendingUserId(userId);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["users"] }),
        queryClient.cancelQueries({ queryKey: ["outgoingFriendReqs"] }),
      ]);
      const previousUsers = queryClient.getQueryData(["users"]);
      const previousOutgoing = queryClient.getQueryData(["outgoingFriendReqs"]);
      const user = (previousUsers || []).find((item) => item._id === userId);

      queryClient.setQueryData(["users"], (current = []) =>
        current.map((item) =>
          item._id === userId
            ? {
                ...item,
                relationship: "outgoing",
                relationshipStatus: "pending_outgoing",
                optimistic: true,
              }
            : item,
        ),
      );
      queryClient.setQueryData(["outgoingFriendReqs"], (current = []) => [
        ...current,
        { _id: `optimistic-${userId}`, recipient: user, optimistic: true },
      ]);

      return { previousUsers, previousOutgoing };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outgoingFriendReqs"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({
        queryKey: ["incomingFriendRequestCount"],
      });
    },
    onError: (error, _, context) => {
      queryClient.setQueryData(["users"], context?.previousUsers);
      queryClient.setQueryData(
        ["outgoingFriendReqs"],
        context?.previousOutgoing,
      );
      toast.error(
        error.response?.data?.message || "Unable to send friend request",
      );
    },
    onSettled: () => {
      setPendingUserId(null);
    },
  });

  const outgoingRequestsIds = new Set(
    (outgoingFriendReqs ?? [])
      .map((request) => request.recipient?._id)
      .filter(Boolean),
  );

  return (
    <div className="min-h-0 w-full flex-1 overflow-y-auto p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:p-6 lg:p-8">
      <div className="container mx-auto space-y-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Your Friends
          </h2>
          <Link to="/notifications" className="btn btn-outline btn-sm">
            <UsersIcon className="mr-2 size-4" />
            Friend Requests
          </Link>
        </div>

        {/* FRIENDS */}

        {loadingFriends ? (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : friends.length === 0 ? (
          // <div className="flex items-center justify-center p-4">
          //   <p className="text-muted-foreground">
          //     You don't have any friends yet.
          //   </p>
          // </div>
          <NoFriendsFound />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {friends.map((friend) => (
              <FriendCard key={friend._id} friend={friend} />
            ))}
          </div>
        )}

        <section>
          <div className="mb-6 sm:mb-8 ">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  People You May Know
                </h2>

                <p className=" opacity-70">
                  Connect with fellow HyeChatters and expand your circle! Click
                  "Add Friend" to start a new connection!
                </p>
              </div>
            </div>
          </div>

          {loadingUsers ? (
            <div className="flex justify-center py-12">
              <span className="loading loading-spinner loading-lg" />
            </div>
          ) : recommendedUsers.length === 0 ? (
            <div className="card bg-base-200 p-6 text-center">
              <h3 className="font-semibold text-lg mb-2">
                No recommendations available
              </h3>
              <p className="text-base-content opacity-70">
                Check back later for new suggestions.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recommendedUsers.map((user) => {
                const hasRequestBeenSent = outgoingRequestsIds.has(user._id);
                const isThisUserPending = pendingUserId === user._id;

                return (
                  <div
                    key={user._id}
                    className="card bg-base-200 hover:shadow-lg transition-all duration-300"
                  >
                    <div className="card-body p-5 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="avatar size-16 rounded-full">
                          <img
                            src={user.profilePic}
                            alt={`${user.fullName}'s profile`}
                          />
                        </div>

                        <div>
                          <h3 className="font-semibold text-lg">
                            {user.fullName}
                          </h3>
                          {user.location && (
                            <div className="flex items-center text-xs opacity-70 mt-1">
                              <MapPinIcon className="size-3 mr-1" />
                              {user.location}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Language with flags */}
                      <div className="flex flex-wrap gap-1.5">
                        <span className="badge badge-secondary">
                          {getLanguageFlag(user.nativeLanguage)}
                          Native : {capitalize(user.nativeLanguage)}
                        </span>
                        <span className="badge badge-outline">
                          {getLanguageFlag(user.learningLanguage)}
                          Learning : {capitalize(user.learningLanguage)}
                        </span>
                      </div>

                      {user.bio && (
                        <p className="text-sm opacity-70">{user.bio}</p>
                      )}

                      {/* Action Button */}

                      <button
                        className={`btn w-full mt-2 ${
                          hasRequestBeenSent ? "btn-disabled" : "btn-primary"
                        }`}
                        onClick={() => sendRequestMutation(user._id)}
                        disabled={hasRequestBeenSent || isThisUserPending}
                      >
                        {hasRequestBeenSent ? (
                          <>
                            <CheckCircleIcon className="size-4 mr-2" /> Request
                            Sent
                          </>
                        ) : (
                          <>
                            <UserPlusIcon className="size-4 mr-2" /> Add Friend
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default HomePage;
