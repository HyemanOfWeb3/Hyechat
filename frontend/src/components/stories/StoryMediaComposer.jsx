import { useEffect, useMemo, useState } from "react";
import { ImagePlus, RotateCcw, Scissors, X } from "lucide-react";

const MAX_CAPTION_LENGTH = 500;

const formatTime = (seconds) => {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = Math.floor(safeSeconds % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

const StoryMediaComposer = ({
  file,
  caption,
  onCaptionChange,
  onCancel,
  onReplace,
  onResetTrim,
  onTrim,
  onSubmit,
  isSubmitting,
  isTrimmed,
  error,
}) => {
  const previewUrl = useMemo(() => URL.createObjectURL(file), [file]);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const isVideo = file.type.startsWith("video/");
  const requiresTrim = isVideo && duration > 60 && !isTrimmed;
  const invalidTrimmedDuration = isVideo && isTrimmed && duration > 60.5;
  const canPost =
    previewReady &&
    !previewError &&
    !requiresTrim &&
    !invalidTrimmedDuration &&
    !isSubmitting;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleVideoMetadata = (event) => {
    const videoDuration = event.currentTarget.duration;
    if (!Number.isFinite(videoDuration) || videoDuration <= 0) {
      setPreviewError(
        "This video has an invalid duration and cannot be posted.",
      );
      return;
    }
    setDuration(videoDuration);
    setPreviewReady(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="story-composer-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onCancel();
      }}
    >
      <section className="flex max-h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-2xl sm:max-h-[calc(100dvh-3rem)]">
        <header className="flex items-center justify-between gap-3 border-b border-base-300 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 id="story-composer-title" className="font-semibold">
              {isVideo ? "Preview video Story" : "Preview image Story"}
            </h2>
            <p className="truncate text-xs opacity-60">{file.name}</p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-circle btn-sm"
            onClick={onCancel}
            disabled={isSubmitting}
            aria-label="Cancel Story"
            title="Cancel"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-3 sm:grid-cols-[minmax(0,1fr)_minmax(16rem,0.8fr)] sm:p-5">
          <div className="relative flex min-h-64 items-center justify-center overflow-hidden rounded-lg bg-neutral-950 sm:min-h-96">
            {!previewReady && !previewError && (
              <span className="loading loading-spinner loading-md text-white" />
            )}
            {isVideo ? (
              <video
                key={previewUrl}
                src={previewUrl}
                controls
                playsInline
                preload="metadata"
                className="max-h-[52dvh] max-w-full object-contain"
                onLoadedMetadata={handleVideoMetadata}
                onLoadedData={() => setPreviewReady(true)}
                onTimeUpdate={(event) =>
                  setCurrentTime(event.currentTarget.currentTime)
                }
                onError={() => {
                  setPreviewReady(false);
                  setDuration(0);
                  setPreviewError(
                    "Unable to read this video. Try another file.",
                  );
                }}
              />
            ) : (
              <img
                key={previewUrl}
                src={previewUrl}
                alt="Selected Story preview"
                className="max-h-[52dvh] max-w-full object-contain"
                onLoad={(event) => {
                  if (
                    !event.currentTarget.naturalWidth ||
                    !event.currentTarget.naturalHeight
                  ) {
                    setPreviewError(
                      "This image could not be read. Try another file.",
                    );
                    return;
                  }
                  setPreviewReady(true);
                }}
                onError={() => {
                  setPreviewReady(false);
                  setDuration(0);
                  setPreviewError(
                    "Unable to read this image. Try another file.",
                  );
                }}
              />
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            {isVideo && (
              <section className="space-y-3 rounded-lg border border-base-300 p-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">Video duration</span>
                  <span>{formatTime(duration)}</span>
                </div>
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-base-300"
                  role="progressbar"
                  aria-label="Video playback position"
                  aria-valuemin={0}
                  aria-valuemax={Math.max(1, duration)}
                  aria-valuenow={currentTime}
                >
                  <div
                    className="h-full bg-primary"
                    style={{
                      width: `${duration ? (currentTime / duration) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p className="text-xs opacity-70">
                  {formatTime(currentTime)} / {formatTime(duration)}
                  {requiresTrim && " · Trim this video to 60 seconds or less."}
                  {invalidTrimmedDuration &&
                    " · The trimmed file is over the 60 second limit. Trim again."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm gap-2"
                    onClick={onTrim}
                    disabled={isSubmitting || !previewReady}
                  >
                    <Scissors className="size-4" />
                    {isTrimmed ? "Adjust trim" : "Trim video"}
                  </button>
                  {isTrimmed && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm gap-2"
                      onClick={onResetTrim}
                      disabled={isSubmitting}
                    >
                      <RotateCcw className="size-4" />
                      Reset trim
                    </button>
                  )}
                </div>
              </section>
            )}

            <label className="form-control w-full">
              <span className="mb-1 flex items-center justify-between gap-2 text-sm font-medium">
                Caption (optional)
                {caption && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => onCaptionChange("")}
                    disabled={isSubmitting}
                  >
                    Clear caption
                  </button>
                )}
              </span>
              <textarea
                value={caption}
                onChange={(event) =>
                  onCaptionChange(
                    event.target.value.slice(0, MAX_CAPTION_LENGTH),
                  )
                }
                maxLength={MAX_CAPTION_LENGTH}
                rows={5}
                placeholder="Add a caption"
                className="textarea textarea-bordered min-h-28 w-full resize-y whitespace-pre-wrap"
                disabled={isSubmitting}
              />
              <span className="mt-1 text-right text-xs opacity-60">
                {caption.length}/{MAX_CAPTION_LENGTH}
              </span>
            </label>

            {previewError && (
              <p className="text-sm text-error">{previewError}</p>
            )}
            {error && <p className="text-sm text-error">{error}</p>}
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-base-300 px-3 py-3 sm:px-5">
          <button
            type="button"
            className="btn btn-ghost btn-sm gap-2"
            onClick={onReplace}
            disabled={isSubmitting}
          >
            <ImagePlus className="size-4" />
            Replace media
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm min-w-24"
              onClick={onSubmit}
              disabled={!canPost}
            >
              {isSubmitting ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                "Post Story"
              )}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
};

export default StoryMediaComposer;
