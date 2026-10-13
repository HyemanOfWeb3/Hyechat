import useAuthUser from "../hooks/useAuthUser.js";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import useLogout from "../hooks/useLogout.js";
import {
  BellIcon,
  LogOutIcon,
  MenuIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  ShipWheelIcon,
  SearchIcon,
} from "lucide-react";
import ThemeSelector from "./ThemeSelector.jsx";
import useUnreadNotificationsCount from "../hooks/useUnreadNotificationsCount.js";
import UserAvatar from "./UserAvatar.jsx";

const Navbar = ({ onMenuClick, onCollapseClick, sidebarCollapsed }) => {
  const { authUser } = useAuthUser();
  const location = useLocation();
  const navigate = useNavigate();
  const [globalSearch, setGlobalSearch] = useState("");
  const isChatPage = location.pathname?.startsWith("/chat");

  //   const queryClient = useQueryClient();

  //   const { mutate: logoutMutation } = useMutation({
  //     mutationFn: logout,
  //     onSuccess: () => queryClient.invalidateQueries({ queryKey: ["authUser"] }),
  //   });

  const { logoutMutation } = useLogout();
  const unreadCount = useUnreadNotificationsCount();

  const submitGlobalSearch = (event) => {
    event.preventDefault();
    const query = globalSearch.trim();
    if (query.length < 2) return;
    navigate(`/search?query=${encodeURIComponent(query)}`);
    setGlobalSearch("");
  };

  return (
    <nav className="sticky top-0 z-30 flex h-16 items-center border-b border-base-300 bg-base-200">
      <div className="container mx-auto min-w-0 px-2 sm:px-6 lg:px-8">
        <div className="flex w-full min-w-0 items-center gap-1 sm:gap-2">
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {onMenuClick && (
              <button
                type="button"
                className="btn btn-ghost btn-square lg:hidden"
                onClick={onMenuClick}
                aria-label="Open navigation"
              >
                <MenuIcon className="size-5" />
              </button>
            )}
            {onCollapseClick && (
              <button
                type="button"
                className="btn btn-ghost btn-square hidden lg:inline-flex"
                onClick={onCollapseClick}
                aria-label={
                  sidebarCollapsed ? "Expand navigation" : "Collapse navigation"
                }
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpenIcon className="size-5" />
                ) : (
                  <PanelLeftCloseIcon className="size-5" />
                )}
              </button>
            )}
          </div>
          {/* LOGO - ONLY ON THE CHAT PAGE */}

          {isChatPage && (
            <div className="min-w-0 pl-1 sm:pl-3">
              <Link to="/" className="flex items-center gap-1.5 sm:gap-2.5">
                <ShipWheelIcon className="size-7 shrink-0 text-primary sm:size-9" />
                <span className="hidden truncate text-3xl font-bold font-mono bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary tracking-wider sm:inline">
                  HyeChat
                </span>
              </Link>
            </div>
          )}

          <div className="ml-auto flex min-w-0 shrink-0 items-center gap-0 sm:gap-2">
            <form
              onSubmit={submitGlobalSearch}
              className="input input-bordered hidden h-10 w-48 items-center gap-2 md:flex lg:w-72"
              role="search"
            >
              <SearchIcon className="size-4 shrink-0 opacity-50" />
              <input
                type="search"
                value={globalSearch}
                onChange={(event) => setGlobalSearch(event.target.value)}
                className="min-w-0 grow"
                placeholder="Search HyeChat"
                aria-label="Search HyeChat"
                minLength={2}
              />
            </form>
            <Link
              to="/search"
              className="btn btn-ghost btn-circle size-11 min-h-0 min-w-0 p-0 md:hidden"
              aria-label="Search HyeChat"
            >
              <SearchIcon className="size-5 text-base-content opacity-70" />
            </Link>
            <Link
              to="/notifications"
              className="btn btn-ghost btn-circle relative size-11 min-h-0 min-w-0 p-0"
              aria-label="Notifications"
            >
              <BellIcon className="h-6 w-6 text-base-content opacity-70" />
              {unreadCount > 0 && (
                <span className="badge badge-error badge-xs absolute -right-1 -top-1 min-w-4 px-1 text-[10px] text-error-content">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          </div>

          <ThemeSelector />

          {authUser ? (
            <>
              {/* User Avatar */}
              <Link
                to="/profile"
                className="inline-flex rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                aria-label="Open profile settings"
              >
                <UserAvatar
                  src={authUser?.profilePic}
                  name={authUser?.fullName}
                  userId={authUser?._id}
                  alt=""
                  className="size-9"
                />
              </Link>

              {/* Logout Button */}
              <button
                onClick={logoutMutation}
                className="btn btn-ghost btn-circle size-11 min-h-0 min-w-0 p-0"
                aria-label="Log out"
              >
                <LogOutIcon className="h-6 w-6 text-base-content opacity-70" />
              </button>
            </>
          ) : (
            <Link to="/login" className="btn btn-primary btn-sm">
              Log in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
