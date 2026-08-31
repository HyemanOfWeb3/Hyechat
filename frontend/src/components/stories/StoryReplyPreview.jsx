import { ArrowLeft, ImageOff, Play, X } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Compact Story-reply preview styled like WhatsApp quoted messages.
 * Mobile-first design with Story media thumbnail (48-56px wide, 64-76px high, 9:16 aspect).
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
  const [videoThumbnail, setVideoThumbnail] = useState(null);

  const borderCls = isDark ? "border-primary/40" : "border-primary/30";
  const bgCls = isDark ? "bg-slate-800/20" : "bg-base-200/40";
  const textCls = isDark ? "text-slate-200" : "text-base-content/80";
  const labelCls = isDark ? "text-slate-400" : "text-base-content/60";
  const unavailableBgCls = isDark ? "bg-slate-900/40" : "bg-base-300/50";

  useEffect(() => {
    if (!isExpanded) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isExpanded]);

  // Extract first frame from video for thumbnail preview
  useEffect(() => {
    if (storyMediaType !== "video" || !storyMediaUrl || imgError) {
      return;
    }

    let isMounted = true;
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.src = storyMediaUrl;
    video.currentTime = 0.1;

    const captureFrame = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 56;
      canvas.height = 75;
      const ctx = canvas.getContext("2d");
      if (ctx && isMounted) {
        ctx.drawImage(video, 0, 0, 56, 75);
        setVideoThumbnail(canvas.toDataURL("image/jpeg", 0.7));
      }
      video.removeEventListener("seeked", captureFrame);
    };

    const handleError = () => {
      if (isMounted) {
        setImgError(true);
      }
      video.removeEventListener("seeked", captureFrame);
    };

    video.addEventListener("seeked", captureFrame);
    video.addEventListener("error", handleError);

    return () => {
      isMounted = false;
      video.removeEventListener("seeked", captureFrame);
      video.removeEventListener("error", handleError);
    };
  }, [storyMediaType, storyMediaUrl, imgError]);

  const handleClick = () => {
    if (storyMediaUrl) {
      setIsExpanded(true);
    }
    if (onClick) onClick();
  };

  const closeExpanded = () => setIsExpanded(false);

  // Handle unavailable/expired Story
  const isUnavailable = !storyMediaUrl || imgError;

  return (
    <>
      {/* Compact WhatsApp-style Story quote – max 28-30% of 320px mobile width (~90px) */}
      <div
        className={`mb-1.5 flex w-fit flex-row items-center gap-2 overflow-hidden rounded-lg border-l-4 border-y-0 border-r-0 px-2 py-1.5 ${borderCls} ${isUnavailable ? unavailableBgCls : bgCls} transition-opacity ${storyMediaUrl && !imgError ? "cursor-pointer hover:opacity-75 active:opacity-60" : ""}`}
        onClick={storyMediaUrl && !imgError ? handleClick : undefined}
        role={storyMediaUrl && !imgError ? "button" : undefined}
        tabIndex={storyMediaUrl && !imgError ? 0 : undefined}
        onKeyDown={(e) => {
          if (
            (e.key === "Enter" || e.key === " ") &&
            storyMediaUrl &&
            !imgError
          ) {
            e.preventDefault();
            handleClick();
          }
        }}
        aria-label={`Story from ${storyOwnerName}`}
      >
        {/* Thumbnail – 48-56px wide × 64-76px high (9:16 aspect) */}
        {isUnavailable ? (
          <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-md bg-base-300/50">
            <ImageOff className="h-4 w-4 opacity-40" />
          </div>
        ) : (
          <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-md bg-base-300">
            {storyMediaType === "image" && (
              <img
                src={storyMediaUrl}
                alt="Story"
                className="h-full w-full object-cover"
                onError={() => setImgError(true)}
              />
            )}
            {storyMediaType === "video" && videoThumbnail && (
              <img
                src={videoThumbnail}
                alt="Video thumbnail"
                className="h-full w-full object-cover"
              />
            )}
            {storyMediaType === "video" && !videoThumbnail && (
              <div className="h-full w-full bg-base-300" />
            )}
            {/* Play indicator for videos */}
            {storyMediaType === "video" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <Play className="h-3 w-3 fill-white text-white" />
              </div>
            )}
          </div>
        )}

        {/* Owner name and Status label – tight typography */}
        <div className="flex min-w-0 flex-col justify-center gap-0.5">
          <div className="flex items-baseline gap-1">
            <span className={`truncate text-xs font-semibold ${textCls}`}>
              {storyOwnerName}
            </span>
            <span className={`shrink-0 text-xs font-normal ${labelCls}`}>
              • Status
            </span>
          </div>

          {/* Duration or content preview – single line */}
          <p className={`truncate text-xs leading-tight ${labelCls}`}>
            {storyMediaType === "video" ? "📹 Video" : "📸 Photo"}
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
