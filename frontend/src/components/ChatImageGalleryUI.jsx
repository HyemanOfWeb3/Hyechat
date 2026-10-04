import { ArrowLeft, ArrowRight, Download } from "lucide-react";
import { useGalleryContext } from "stream-chat-react";

const GalleryAction = ({ children, label, onClick, href, download }) => {
  const className =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/20 bg-black/55 px-3 text-sm font-medium text-white shadow-lg backdrop-blur transition hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";

  if (href) {
    return (
      <a
        href={href}
        download={download}
        target="_blank"
        rel="noreferrer"
        aria-label={label}
        title={label}
        className={className}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={className}
    >
      {children}
    </button>
  );
};

const ChatImageGalleryUI = () => {
  const {
    currentIndex,
    currentItem,
    hasNext,
    hasPrevious,
    itemCount,
    goToNext,
    goToPrevious,
    onRequestClose,
  } = useGalleryContext();
  const mediaUrl = currentItem.videoUrl || currentItem.imageUrl;
  const mediaAlt = currentItem.alt || currentItem.title || "Chat attachment";

  return (
    <div className="flex h-[100dvh] w-screen flex-col overflow-hidden bg-black/95 text-white">
      <header className="flex min-h-[4.5rem] shrink-0 items-center justify-between gap-3 px-3 pt-[env(safe-area-inset-top)] sm:px-5">
        <GalleryAction label="Back to chat" onClick={onRequestClose}>
          <ArrowLeft className="size-5 shrink-0" aria-hidden="true" />
          <span>Back to chat</span>
        </GalleryAction>

        <div className="min-w-0 flex-1 truncate text-center text-sm text-white/75">
          {itemCount > 1 ? `${currentIndex + 1} / ${itemCount}` : mediaAlt}
        </div>

        {mediaUrl ? (
          <GalleryAction label="Download attachment" href={mediaUrl} download>
            <Download className="size-5" aria-hidden="true" />
            <span className="hidden sm:inline">Download</span>
          </GalleryAction>
        ) : (
          <span className="w-11 shrink-0" aria-hidden="true" />
        )}
      </header>

      <main className="relative flex min-h-0 flex-1 items-center justify-center px-2 py-2 sm:px-5">
        {hasPrevious && (
          <button
            type="button"
            onClick={goToPrevious}
            aria-label="Previous image"
            title="Previous image"
            className="absolute left-2 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white shadow-lg backdrop-blur transition hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:left-5"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </button>
        )}

        {currentItem.videoUrl ? (
          <video
            key={currentItem.videoUrl}
            src={currentItem.videoUrl}
            poster={currentItem.videoThumbnailUrl}
            controls
            autoPlay
            playsInline
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <img
            key={currentItem.imageUrl}
            src={currentItem.imageUrl}
            alt={mediaAlt}
            className="max-h-full max-w-full object-contain"
          />
        )}

        {hasNext && (
          <button
            type="button"
            onClick={goToNext}
            aria-label="Next image"
            title="Next image"
            className="absolute right-2 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white shadow-lg backdrop-blur transition hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-5"
          >
            <ArrowRight className="size-5" aria-hidden="true" />
          </button>
        )}
      </main>

      <footer className="h-[calc(env(safe-area-inset-bottom)+0.5rem)] shrink-0" />
    </div>
  );
};

export default ChatImageGalleryUI;
