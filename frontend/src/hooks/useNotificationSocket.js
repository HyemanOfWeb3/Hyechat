import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as Ably from "ably";
import useAuthUser from "./useAuthUser.js";

const notificationsKey = ["notifications"];
const unreadCountKey = ["notifications", "unreadCount"];
const relationshipNotificationTypes = new Set([
  "friend_request",
  "friend_accepted",
  "friend_declined",
  "friend_cancelled",
  "friend_removed",
]);
const addNotificationToCache = (queryClient, notification) => {
  let alreadyCached = false;

  queryClient.setQueryData(notificationsKey, (current) => {
    if (!current) {
      return {
        pages: [
          {
            notifications: [notification],
            unreadCount: notification.read === false ? 1 : 0,
            pagination: { page: 1, limit: 20, hasMore: false },
          },
        ],
        pageParams: [1],
      };
    }

    const containsNotification = current.pages.some((page) =>
      page.notifications?.some((item) => item._id === notification._id),
    );
    if (containsNotification) {
      alreadyCached = true;
      return current;
    }

    return {
      ...current,
      pages: current.pages.map((page, index) =>
        index === 0
          ? {
              ...page,
              notifications: [notification, ...(page.notifications || [])],
              unreadCount:
                (page.unreadCount || 0) + (notification.read === false ? 1 : 0),
            }
          : page,
      ),
    };
  });

  if (alreadyCached || notification.read !== false) return;

  queryClient.setQueryData(unreadCountKey, (current) => ({
    ...(current || {}),
    unreadCount: (current?.unreadCount || 0) + 1,
  }));
};

const useNotificationSocket = () => {
  const queryClient = useQueryClient();
  const { authUser } = useAuthUser();

  useEffect(() => {
    if (!authUser?._id) return undefined;

    const refetchNotifications = () => {
      queryClient.invalidateQueries({ queryKey: notificationsKey });
      queryClient.invalidateQueries({ queryKey: unreadCountKey });
    };
    const ably = new Ably.Realtime({
      authUrl: "/api/notifications/ably-token",
      authMethod: "POST",
      withCredentials: true,
    });
    const channel = ably.channels.get(`notifications:user:${authUser._id}`);

    const handleNotification = (message) => {
      const notification = message.data;
      if (notification?._id) {
        addNotificationToCache(queryClient, notification);
        if (relationshipNotificationTypes.has(notification.type)) {
          queryClient.invalidateQueries({ queryKey: ["friendsPage"] });
          queryClient.invalidateQueries({ queryKey: ["userDiscovery"] });
          queryClient.invalidateQueries({ queryKey: ["relationshipRequests"] });
          queryClient.invalidateQueries({ queryKey: ["friends"] });
          queryClient.invalidateQueries({
            queryKey: ["incomingFriendRequestCount"],
          });
        }
      }
    };

    const handleConnectionChange = ({ current }) => {
      if (current === "connected") refetchNotifications();
    };

    channel.subscribe("notification.created", handleNotification);
    ably.connection.on(handleConnectionChange);
    window.addEventListener("focus", refetchNotifications);

    return () => {
      channel.unsubscribe("notification.created", handleNotification);
      ably.connection.off(handleConnectionChange);
      window.removeEventListener("focus", refetchNotifications);
      ably.close();
    };
  }, [authUser?._id, queryClient]);
};

export default useNotificationSocket;
