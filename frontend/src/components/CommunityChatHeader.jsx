import { ArrowLeft, MoreHorizontal, Search, UsersRound, X } from "lucide-react";
import { Link } from "react-router-dom";

const CommunityAvatar = ({ community, size = "size-11" }) => (
  <div className={`avatar shrink-0 ${size}`}>
    <div className="size-full rounded-2xl bg-primary/15 text-primary">
      {community?.avatar ? (
        <img src={community.avatar} alt={community.name} />
      ) : (
        <span className="flex size-full items-center justify-center font-bold">
          {community?.name?.charAt(0).toUpperCase() || "C"}
        </span>
      )}
    </div>
  </div>
);

const CommunityChatHeader = ({
  community,
  onOpenInfo,
  isSearchOpen,
  searchQuery,
  onSearchToggle,
  onSearchChange,
}) => (
  <header className="community-chat-header sticky top-0 z-20 flex min-h-[72px] shrink-0 items-center gap-3 border-b border-base-300/70 bg-base-100/95 px-3 py-3 backdrop-blur sm:px-5">
    <Link
      to="/communities"
      className="btn btn-ghost btn-sm btn-square shrink-0 lg:hidden"
      aria-label="Back to communities"
      title="Back to communities"
    >
      <ArrowLeft className="size-5" />
    </Link>
    <button
      type="button"
      className="flex min-w-0 flex-1 items-center gap-3 text-left"
      onClick={onOpenInfo}
      aria-label="Open community information"
    >
      <CommunityAvatar community={community} />
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-bold sm:text-base">
          {community.name}
        </span>
        <span className="block truncate text-xs opacity-60">
          {community.members?.length || 0} members
          {community.description ? ` · ${community.description}` : ""}
        </span>
      </span>
    </button>
    <div className="flex shrink-0 items-center gap-1">
      {isSearchOpen && (
        <label className="input input-bordered input-sm flex w-[min(42vw,220px)] items-center gap-2">
          <Search className="size-4 opacity-60" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search messages"
            aria-label="Search messages"
            autoFocus
          />
          <button
            type="button"
            className="opacity-60 hover:opacity-100"
            onClick={onSearchToggle}
            aria-label="Close message search"
          >
            <X className="size-4" />
          </button>
        </label>
      )}
      {!isSearchOpen && (
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-square"
          onClick={onSearchToggle}
          aria-label="Search messages"
          title="Search messages"
        >
          <Search className="size-4" />
        </button>
      )}
      <button
        type="button"
        className="btn btn-ghost btn-sm btn-square hidden sm:inline-flex"
        onClick={onOpenInfo}
        aria-label="View community members"
        title="View members"
      >
        <UsersRound className="size-4" />
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-sm btn-square"
        onClick={onOpenInfo}
        aria-label="More community options"
        title="More options"
      >
        <MoreHorizontal className="size-5" />
      </button>
    </div>
  </header>
);

export { CommunityAvatar };
export default CommunityChatHeader;
