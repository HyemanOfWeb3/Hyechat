import { ArrowLeft, ImageOff, X } from "lucide-react";
import { useEffect, useState } from "react";

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
  const [isExpanded, setIsExpanded] = useState(false);

  const borderCls = isDark ? "border-slate-600/50" : "border-base-content/20";
  const bgCls = isDark ? "bg-slate-800/40" : "bg-base-300/30";
  const textCls = isDark ? "text-slate-300" : "text-base-content/70";
  const labelCls = isDark ? "text-slate-400" : "text-base-content/60";

  useEffect(() => {
    if (!isExpanded) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isExpanded]);

  const handleClick = () => {
    if (storyMediaUrl) {
      setIsExpanded(true);
    }
    if (onClick) onClick();
  };

  const closeExpanded = () => setIsExpanded(false);

  return (
    <>
      <div
        className={`mb-2 flex max-h-24 min-w-0 items-stretch gap-2.5 overflow-hidden rounded-lg border-l-3 border-y-0 border-r-0 px-3 py-2 ${borderCls} ${bgCls} cursor-pointer transition-opacity hover:opacity-80 active:opacity-70`}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
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
            <div className="relative size-full bg-base-300">
              <video
                src={storyMediaUrl}
                className="size-full object-cover"
                onError={() => setImgError(true)}
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <div className="text-xs text-white">Video</div>
              </div>
            </div>
          ) : (
            <div className="flex size-full items-center justify-center bg-base-300">
              <ImageOff className="size-5 opacity-40" />
            </div>
          )}
        </div>

        {/* Metadata and preview text */}
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <div className={`text-xs font-semibold leading-tight ${textCls}`}>
            {storyOwnerName}
            <span className={`ml-1 font-normal ${labelCls}`}>• Status</span>
          </div>

          <p
            className={`mt-0.5 truncate text-xs font-normal leading-snug ${labelCls}`}
          >
            {storyText?.trim() ||
              (storyMediaType === "video" ? "📹 Video" : "📸 Photo")}
          </p>
        </div>
      </div>

      {isExpanded && storyMediaUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Story media from ${storyOwnerName}`}
          onClick={closeExpanded}
        >
          <div className="relative flex h-[min(100dvh-1rem,760px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/80 shadow-2xl">
            <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  closeExpanded();
                }}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white shadow-lg backdrop-blur-sm transition hover:bg-black/45"
                aria-label="Back to chat"
                title="Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur-sm">
                {storyOwnerName}
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  closeExpanded();
                }}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white shadow-lg backdrop-blur-sm transition hover:bg-black/45"
                aria-label="Close media viewer"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-1 items-center justify-center bg-black px-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-20">
              {storyMediaType === "video" ? (
                <video
                  src={storyMediaUrl}
                  className="max-h-full max-w-full rounded-xl object-contain"
                  controls
                  playsInline
                  autoPlay
                  onClick={(event) => event.stopPropagation()}
                  onError={() => setImgError(true)}
                />
              ) : (
                <img
                  src={storyMediaUrl}
                  alt={`${storyOwnerName} story`}
                  className="max-h-full max-w-full rounded-xl object-contain"
                  onClick={(event) => event.stopPropagation()}
                  onError={() => setImgError(true)}
                />
              )}
            </div>

            {storyText?.trim() && (
              <div className="border-t border-white/10 bg-black/20 px-4 py-3 text-sm text-white/90 backdrop-blur-sm">
                {storyText}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default StoryReplyPreview;
