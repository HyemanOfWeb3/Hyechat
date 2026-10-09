import { Link } from "react-router-dom";
import { getLanguageFlag } from "./LanguageFlag.jsx";
import UserProfileLink from "./UserProfileLink.jsx";
import UserAvatar from "./UserAvatar.jsx";

const FriendCard = ({ friend }) => {
  return (
    <div className="card bg-base-200 hover:shadow-md transition-shadow">
      <div className="card-body p-4">
        {/* USER INFO */}
        <UserProfileLink
          userId={friend._id}
          className="mb-3 flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <UserAvatar
            src={friend.profilePic}
            name={friend.fullName}
            userId={friend._id}
            alt=""
            className="size-12"
          />
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
