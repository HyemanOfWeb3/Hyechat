const NotificationsHeader = ({
  unreadCount = 0,
  onMarkAllAsRead,
  isMarkingAllAsRead = false,
}) => {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Notifications
        </h1>
        {unreadCount > 0 && (
          <span className="badge badge-primary">{unreadCount}</span>
        )}
      </div>

      {unreadCount > 0 && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onMarkAllAsRead}
          disabled={isMarkingAllAsRead}
        >
          {isMarkingAllAsRead && (
            <span className="loading loading-spinner loading-xs" />
          )}
          Mark all as read
        </button>
      )}
    </header>
  );
};

export default NotificationsHeader;
