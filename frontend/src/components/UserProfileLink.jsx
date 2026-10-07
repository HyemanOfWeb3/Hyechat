import { Link } from "react-router-dom";

const UserProfileLink = ({ userId, children, className, ...linkProps }) => {
  const id = userId?.toString?.() || userId;
  if (typeof id !== "string" || !id.trim()) return <>{children}</>;

  return (
    <Link
      to={`/profile/${encodeURIComponent(id)}`}
      className={className}
      {...linkProps}
    >
      {children}
    </Link>
  );
};

export default UserProfileLink;
