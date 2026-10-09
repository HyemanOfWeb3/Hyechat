import useAuthUser from "../hooks/useAuthUser";
import { useLocation, Link } from "react-router-dom";
import {
  ShipWheelIcon,
  HomeIcon,
  UsersIcon,
  BellIcon,
  MessageSquareIcon,
  CompassIcon,
  BookOpenIcon,
  UsersRoundIcon,
  BookmarkIcon,
  PhoneCallIcon,
  SettingsIcon,
  XIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getIncomingFriendRequestCount } from "../lib/api.js";
import useUnreadNotificationsCount from "../hooks/useUnreadNotificationsCount.js";
import UserAvatar from "./UserAvatar.jsx";

const Sidebar = ({ collapsed = false, mobileOpen = false, onClose }) => {
  const { authUser } = useAuthUser();
  const location = useLocation();
  const currentPath = location.pathname;
  const unreadCount = useUnreadNotificationsCount();
  const { data: friendRequestCount = 0 } = useQuery({
    queryKey: ["incomingFriendRequestCount"],
    queryFn: getIncomingFriendRequestCount,
    staleTime: 30000,
  });

  const navItem = (to, label, Icon, badge) => (
    <Link
      to={to}
      title={collapsed ? label : undefined}
      onClick={onClose}
      className={`btn btn-ghost justify-start w-full gap-3 px-3 normal-case ${collapsed ? "lg:justify-center lg:px-2" : ""} ${currentPath === to ? "btn-active" : ""}`}
    >
      <Icon className="size-5 text-base-content opacity-70" />
      <span className={collapsed ? "lg:hidden" : ""}>{label}</span>
      {badge > 0 && (
        <span className="badge badge-error badge-sm ml-auto text-error-content">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={onClose}
          aria-label="Close navigation"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-base-300 bg-base-200 shadow-xl transition-transform lg:sticky lg:z-0 lg:shadow-none ${collapsed ? "lg:w-20" : "lg:w-64"} ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* LOGO */}

        <div
          className={`flex items-center border-b border-base-300 p-5 ${collapsed ? "lg:justify-center lg:px-2" : "justify-between"}`}
        >
          <Link to="/" className="flex items-center gap-2.5">
            <ShipWheelIcon className="size-9 text-primary" />
            <span
              className={`font-bold text-3xl font-mono bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary tracking-wider ${collapsed ? "lg:hidden" : ""}`}
            >
              HyeChat
            </span>
          </Link>
          <button
            type="button"
            className="btn btn-ghost btn-square lg:hidden"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <XIcon className="size-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="space-y-1">
            <p
              className={`px-3 pb-1 text-xs font-bold uppercase tracking-wider opacity-50 ${collapsed ? "lg:hidden" : ""}`}
            >
              Main
            </p>
            {navItem("/", "Home", HomeIcon)}
            {navItem("/chat", "Chats", MessageSquareIcon)}
            {navItem("/friends", "Friends", UsersIcon, friendRequestCount)}
            {navItem("/explore", "Explore", CompassIcon)}
            {navItem("/stories", "Stories", BookOpenIcon)}
          </div>
          <div className="space-y-1">
            <p
              className={`px-3 pb-1 text-xs font-bold uppercase tracking-wider opacity-50 ${collapsed ? "lg:hidden" : ""}`}
            >
              Connect
            </p>
            {navItem("/communities", "Communities", UsersRoundIcon)}
            {navItem("/notifications", "Notifications", BellIcon, unreadCount)}
          </div>
          <div className="space-y-1">
            <p
              className={`px-3 pb-1 text-xs font-bold uppercase tracking-wider opacity-50 ${collapsed ? "lg:hidden" : ""}`}
            >
              Utility
            </p>
            {navItem("/saved", "Saved", BookmarkIcon)}
            {navItem("/calls", "Calls", PhoneCallIcon)}
          </div>
          <div className="space-y-1">
            <p
              className={`px-3 pb-1 text-xs font-bold uppercase tracking-wider opacity-50 ${collapsed ? "lg:hidden" : ""}`}
            >
              Account
            </p>
            {navItem("/profile", "Profile", UsersIcon)}
            {navItem("/settings", "Settings", SettingsIcon)}
          </div>
        </nav>

        {/* USER PROFILE SECTION */}

        <div
          className={`mt-auto border-t border-base-300 p-4 ${collapsed ? "lg:px-2" : ""}`}
        >
          <div className="flex items-center gap-3">
            <UserAvatar
              src={authUser?.profilePic}
              name={authUser?.fullName}
              userId={authUser?._id}
              alt=""
              className="size-10"
            />
            <div className={`flex-1 ${collapsed ? "lg:hidden" : ""}`}>
              <p className="font-semibold text-sm">{authUser?.fullName}</p>
              <p className="text-xs  text-success flex items-center gap-1">
                <span className="size-2 rounded-full bg-success inline-block" />
                Online
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
