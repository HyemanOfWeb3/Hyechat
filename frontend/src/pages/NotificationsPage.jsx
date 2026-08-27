import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  deleteNotification,
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../lib/api.js";
import NoNotificationsFound from "../components/NoNotificationsFound.jsx";
import NotificationItem from "../components/NotificationItem.jsx";
import NotificationsHeader from "../components/NotificationsHeader.jsx";

const notificationsKey = ["notifications"];
const unreadCountKey = ["notifications", "unreadCount"];

const updateLoadedNotifications = (queryClient, updateNotification) => {
  queryClient.setQueryData(notificationsKey, (current) => {
    if (!current) return current;

    return {
      ...current,
      pages: current.pages.map((page) => ({
        ...page,
        notifications: page.notifications
          .map(updateNotification)
          .filter(Boolean),
      })),
    };
  });
};

const setUnreadCount = (queryClient, updateCount) => {
  queryClient.setQueryData(notificationsKey, (current) => {
    if (!current) return current;

    return {
      ...current,
      pages: current.pages.map((page, index) =>
        index === 0
          ? {
              ...page,
              unreadCount: Math.max(0, updateCount(page.unreadCount ?? 0)),
            }
          : page,
      ),
    };
  });
  queryClient.setQueryData(unreadCountKey, (current) => ({
    ...(current || {}),
    unreadCount: Math.max(0, updateCount(current?.unreadCount ?? 0)),
  }));
};

const NotificationsPage = () => {
  const queryClient = useQueryClient();
  const {
    data,
    error,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: notificationsKey,
    queryFn: ({ pageParam }) => getNotifications({ page: pageParam, limit: 20 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination?.hasMore ? lastPage.pagination.page + 1 : undefined,
  });

  const notifications =
    data?.pages.flatMap((page) => page.notifications || []) || [];
  const unreadCount = data?.pages[0]?.unreadCount ?? 0;

  const markAsReadMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: (_, notificationId) => {
      const notification = notifications.find((item) => item._id === notificationId);
      updateLoadedNotifications(queryClient, (item) =>
        item._id === notificationId ? { ...item, read: true } : item,
      );
      if (notification?.read === false) setUnreadCount(queryClient, (count) => count - 1);
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => {
      updateLoadedNotifications(queryClient, (item) => ({ ...item, read: true }));
      setUnreadCount(queryClient, () => 0);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteNotification,
    onSuccess: (_, notificationId) => {
      const notification = notifications.find((item) => item._id === notificationId);
      updateLoadedNotifications(queryClient, (item) =>
        item._id === notificationId ? null : item,
      );
      if (notification?.read === false) setUnreadCount(queryClient, (count) => count - 1);
    },
  });

  if (isLoading) {
    return (
      <div className="flex w-full justify-center py-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-4 py-12 text-center">
        <p className="text-error">Unable to load notifications.</p>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => refetch()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8">
      <div className="container mx-auto max-w-4xl space-y-6">
        <NotificationsHeader
          unreadCount={unreadCount}
          onMarkAllAsRead={() => markAllAsReadMutation.mutate()}
          isMarkingAllAsRead={markAllAsReadMutation.isPending}
        />

        {notifications.length === 0 ? (
          <NoNotificationsFound />
        ) : (
          <div className="space-y-3" role="list" aria-label="Notifications">
            {notifications.map((notification) => (
              <div key={notification._id} role="listitem">
                <NotificationItem
                  notification={notification}
                  onMarkAsRead={(id) => markAsReadMutation.mutateAsync(id)}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  isMarkingAsRead={
                    markAsReadMutation.isPending &&
                    markAsReadMutation.variables === notification._id
                  }
                  isDeleting={
                    deleteMutation.isPending &&
                    deleteMutation.variables === notification._id
                  }
                />
              </div>
            ))}
          </div>
        )}

        {hasNextPage && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage && (
                <span className="loading loading-spinner loading-sm" />
              )}
              {isFetchingNextPage ? "Loading..." : "Load more"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;