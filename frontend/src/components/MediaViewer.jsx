import { ArrowLeft, ImageOff, LoaderCircle, X } from "lucide-react";
import { useEffect, useState } from "react";

const MediaViewer = ({ media, onClose }) => {
  const [isLoading, setIsLoading] = useState(Boolean(media?.url));
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!media) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [media, onClose]);

  if (!media) return null;

  const isVideo =
    media.type === "video" || media.mimeType?.startsWith("video/");
  const hasUsableMedia = Boolean(media.url);

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label={media.alt || "Full size media"}
      onClick={onClose}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onClose?.();
          }}
          aria-label="Back to chat"
          title="Back"
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white shadow-lg backdrop-blur-sm transition hover:bg-black/45"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onClose?.();
          }}
          aria-label="Close media viewer"
          title="Close"
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white shadow-lg backdrop-blur-sm transition hover:bg-black/45"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div
        className="flex h-full w-full items-center justify-center overflow-hidden px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-[calc(env(safe-area-inset-top)+4rem)]"
        onClick={(event) => event.stopPropagation()}
      >
        {hasUsableMedia && !hasError ? (
          isVideo ? (
            <video
              key={media.url}
              src={media.url}
              controls
              playsInline
              autoPlay
              className="max-h-[calc(100dvh-6rem)] max-w-[calc(100vw-1.5rem)] rounded-xl object-contain"
              onLoadStart={() => {
                setIsLoading(true);
                setHasError(false);
              }}
              onError={() => {
                setHasError(true);
                setIsLoading(false);
              }}
              onLoadedData={() => setIsLoading(false)}
              onClick={(event) => event.stopPropagation()}
            />
          ) : (
            <img
              key={media.url}
              src={media.url}
              alt={media.alt || "Shared media"}
              className="max-h-[calc(100dvh-6rem)] max-w-[calc(100vw-1.5rem)] rounded-xl object-contain"
              onLoad={() => {
                setIsLoading(false);
                setHasError(false);
              }}
              onError={() => {
                setHasError(true);
                setIsLoading(false);
              }}
              onClick={(event) => event.stopPropagation()}
            />
          )
        ) : (
          <div className="flex max-w-sm flex-col items-center justify-center rounded-2xl border border-white/15 bg-slate-900/80 px-6 py-5 text-center text-white shadow-2xl">
            <ImageOff
              className="mb-3 h-8 w-8 text-slate-400"
              aria-hidden="true"
            />
            <p className="text-base font-medium">Media unavailable</p>
            <p className="mt-1 text-sm text-slate-300">
              This image could not be loaded.
            </p>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onClose?.();
              }}
              className="mt-4 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15"
            >
              Close
            </button>
          </div>
        )}

        {isLoading && hasUsableMedia && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[1px]">
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/90 shadow-lg">
              <LoaderCircle
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
              <span>Loading…</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaViewer;
