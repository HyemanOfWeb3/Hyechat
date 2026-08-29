import { ImageOff } from "lucide-react";
import { useState } from "react";

/**
 * Compact Story-reply preview styled like a WhatsApp-style quoted message.
 * Embedded inside a chat message bubble as a compact quote.
 *
 * Props:
 *   storyMediaUrl   {string}  - Story.mediaUrl stored on the message
 *   storyMediaType  {string}  - Story.mediaType stored on the message (e.g. "image")
 *   storyText       {string}  - Story text/caption
 *   storyOwnerName  {string}  - Name of story owner/sender
 *   isDark          {boolean} - match surrounding chat theme
 *   onClick         {function} - optional callback when quote is clicked
 */
const StoryReplyPreview = ({
  storyMediaUrl,
  storyMediaType,
  storyText,
  storyOwnerName = "Story",
  isDark = false,
  onClick,
}) => {
  const [imgError, setImgError] = useState(false);

  const borderCls = isDark ? "border-slate-600/50" : "border-base-content/20";
  const bgCls = isDark ? "bg-slate-800/40" : "bg-base-300/30";
  const textCls = isDark ? "text-slate-300" : "text-base-content/70";
  const labelCls = isDark ? "text-slate-400" : "text-base-content/60";

  const handleClick = () => {
    if (onClick) onClick();
  };

  return (
    <div
      className={`mb-2 flex min-w-0 items-stretch gap-2.5 rounded-lg border-l-3 border-y-0 border-r-0 px-3 py-2 ${borderCls} ${bgCls} cursor-pointer transition-opacity hover:opacity-80 active:opacity-70`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          handleClick();
        }
      }}
      aria-label={`Replying to story from ${storyOwnerName}`}
    >
      {/* Thumbnail - compact */}
      <div className="size-12 shrink-0 overflow-hidden rounded-md bg-base-300 flex-shrink-0">
        {storyMediaType === "image" && storyMediaUrl && !imgError ? (
          <img
            src={storyMediaUrl}
            alt="Story preview"
            className="size-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : storyMediaType === "video" && storyMediaUrl && !imgError ? (
          <div className="size-full relative bg-base-300">
            <video
              src={storyMediaUrl}
              className="size-full object-cover"
              onError={() => setImgError(true)}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="text-white text-xs">Video</div>
            </div>
          </div>
        ) : (
          <div className="flex size-full items-center justify-center bg-base-300">
            <ImageOff className="size-5 opacity-40" />
          </div>
        )}
      </div>

      {/* Metadata and preview text */}
      <div className="flex flex-col justify-center min-w-0 flex-1">
        {/* Owner name and type label */}
        <div className={`text-xs font-semibold leading-tight ${textCls}`}>
          {storyOwnerName}
          <span className={`ml-1 font-normal ${labelCls}`}>• Status</span>
        </div>

        {/* Story preview text or media type */}
        <p
          className={`text-xs leading-snug mt-0.5 truncate font-normal ${labelCls}`}
        >
          {storyText?.trim() ||
            (storyMediaType === "video" ? "📹 Video" : "📸 Photo")}
        </p>
      </div>
    </div>
  );
};

export default StoryReplyPreview;
