import { ImageOff } from "lucide-react";
import { useState } from "react";

/**
 * Compact Story-reply preview card rendered inside a chat message bubble.
 * All data comes from Stream message custom fields — no backend lookup needed.
 *
 * Props:
 *   storyMediaUrl   {string}  - Story.mediaUrl stored on the message
 *   storyMediaType  {string}  - Story.mediaType stored on the message (e.g. "image")
 *   isDark          {boolean} - match surrounding chat theme
 */
const StoryReplyPreview = ({
  storyMediaUrl,
  storyMediaType,
  storyText,
  isDark = false,
}) => {
  const [imgError, setImgError] = useState(false);

  const wrapperCls = isDark
    ? "border-slate-600/70 bg-slate-800/60"
    : "border-base-300 bg-base-200/70";

  const labelCls = isDark ? "text-slate-400" : "text-base-content/50";

  return (
    <div
      className={`mb-1.5 flex min-w-0 items-center gap-2 rounded-lg border-l-4 border-y-0 border-r-0 px-2 py-1.5 ${wrapperCls}`}
      aria-label="Story reply preview"
    >
      {/* Thumbnail */}
      <div className="size-9 shrink-0 overflow-hidden rounded-md bg-base-300">
        {storyMediaType === "image" && storyMediaUrl && !imgError ? (
          <img
            src={storyMediaUrl}
            alt="Story"
            className="size-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <ImageOff className="size-4 opacity-40" />
          </div>
        )}
      </div>

      {/* Label */}
      <div
        className={`min-w-0 text-[11px] font-medium leading-tight ${labelCls}`}
      >
        <p>Story</p>
        <p className="mt-0.5 truncate font-normal opacity-80">
          {storyText?.trim() ||
            (storyMediaType === "video" ? "Video" : "Photo")}
        </p>
      </div>
    </div>
  );
};

export default StoryReplyPreview;
