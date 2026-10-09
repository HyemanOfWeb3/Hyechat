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
    <nav className="bg-base-200 border-b border-base-300 sticky top-0 z-30 h-16 flex items-center">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
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
            <div className="pl-5">
              <Link to="/" className="flex items-center gap-2.5">
                <ShipWheelIcon className="size-9 text-primary " />
                <span className="text-3xl font-bold font-mono bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary tracking-wider">
                  HyeChat
                </span>
              </Link>
            </div>
          )}

          <div className="flex items-center gap-3 sm:gap-4 ml-auto">
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
              className="btn btn-ghost btn-circle md:hidden"
              aria-label="Search HyeChat"
            >
              <SearchIcon className="size-5 text-base-content opacity-70" />
            </Link>
            <Link
              to="/notifications"
              className="btn btn-ghost btn-circle relative"
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
                className="btn btn-ghost btn-circle"
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
