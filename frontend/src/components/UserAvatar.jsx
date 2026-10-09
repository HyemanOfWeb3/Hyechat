import { useState } from "react";
import {
  getAvatarFallbackClassName,
  getAvatarImageSource,
  getAvatarInitials,
} from "../lib/avatar.js";

const UserAvatar = ({
  src,
  name = "",
  userId = "",
  alt,
  className = "",
  imageClassName = "",
  fallbackClassName = "",
  loading = "lazy",
}) => {
  const [failedSource, setFailedSource] = useState("");
  const imageSource = getAvatarImageSource(src);
  const accessibleName = alt ?? `Profile picture of ${name || "HyeChat user"}`;

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full ${getAvatarFallbackClassName(name, userId)} ${className}`.trim()}
    >
      {imageSource && imageSource !== failedSource ? (
        <img
          src={imageSource}
          alt={accessibleName}
          className={`size-full object-cover ${imageClassName}`.trim()}
          loading={loading}
          decoding="async"
          onError={() => setFailedSource(imageSource)}
        />
      ) : (
        <span
          role={accessibleName ? "img" : undefined}
          aria-label={accessibleName || undefined}
          aria-hidden={accessibleName ? undefined : true}
          className={`flex size-full items-center justify-center font-semibold ${fallbackClassName}`.trim()}
        >
          {getAvatarInitials(name)}
        </span>
      )}
    </div>
  );
};

export default UserAvatar;
