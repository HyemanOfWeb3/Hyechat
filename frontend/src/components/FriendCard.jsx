import { Link } from "react-router-dom";
import { getLanguageFlag } from "./LanguageFlag.jsx";
import UserProfileLink from "./UserProfileLink.jsx";

const FriendCard = ({ friend }) => {
  return (
    <div className="card bg-base-200 hover:shadow-md transition-shadow">
      <div className="card-body p-4">
        {/* USER INFO */}
        <UserProfileLink
          userId={friend._id}
          className="mb-3 flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <div className="avatar size-12 shrink-0">
            {friend.profilePic ? (
              <img src={friend.profilePic} alt={`${friend.fullName}'s profile`} />
            ) : (
              <span className="flex size-full items-center justify-center rounded-full bg-base-300 font-semibold">
                {friend.fullName?.charAt(0)?.toUpperCase() || "U"}
              </span>
            )}
          </div>
          <h3 className="truncate font-semibold">{friend.fullName}</h3>
        </UserProfileLink>

        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="badge badge-secondary text-xs">
            {getLanguageFlag(friend.nativeLanguage)}
            Native : {friend.nativeLanguage}
          </span>

          <span className="badge badge-secondary text-xs">
            {getLanguageFlag(friend.learningLanguage)}
            Learning : {friend.learningLanguage}
          </span>
        </div>

        <Link to={`/chat/${friend._id}`} className="btn btn-outline w-full">
          Message
        </Link>
      </div>
    </div>
  );
};

export default FriendCard;
