import { useRef } from "react";
import { ArrowDown, ArrowUp, ImagePlus, LoaderCircle, Trash2, Upload, Video } from "lucide-react";

const UploadProgress = ({ item }) => (
  <div className="mt-2 space-y-1">
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="min-w-0 truncate opacity-70">{item.file.name}</span>
      <span className="shrink-0">
        {item.status === "uploading"
          ? `${Math.round(item.progress || 0)}%`
          : item.status === "uploaded"
            ? "Uploaded"
            : item.status === "validating"
              ? "Checking…"
              : item.status === "error"
                ? "Needs attention"
                : "Ready to upload"}
      </span>
    </div>
    {item.status === "uploading" && (
      <progress
        className="progress progress-primary h-1.5 w-full"
        value={item.progress || 0}
        max="100"
        aria-label={`Uploading ${item.file.name}`}
      />
    )}
    {item.error && <p className="text-xs text-error">{item.error}</p>}
  </div>
);

const MarketplaceMediaUploader = ({
  images,
  video,
  disabled = false,
  onAddImages,
  onReplaceImage,
  onRemoveImage,
  onMoveImage,
  onAddVideo,
  onRetryVideo,
  onRemoveVideo,
  errors = [],
  onDismissError,
}) => {
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const replaceImageIdRef = useRef(null);

  const handleImagesSelected = (event) => {
    const files = Array.from(event.currentTarget.files || []);
    const replaceImageId = replaceImageIdRef.current;
    replaceImageIdRef.current = null;
    event.currentTarget.value = "";
    if (replaceImageId) {
      if (files[0]) onReplaceImage(replaceImageId, files[0]);
      return;
    }
    if (files.length) onAddImages(files);
  };

  const handleVideoSelected = (event) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) onAddVideo(file);
  };

  return (
    <section
      className="space-y-3 rounded-xl border border-base-300 bg-base-100 p-3 sm:p-4"
      aria-labelledby="marketplace-media-heading"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 id="marketplace-media-heading" className="font-semibold">
            Listing media
          </h3>
          <p className="text-xs opacity-60">
            Up to 5 JPEG, PNG, or WebP photos (5 MB each) and one MP4 or WebM
            video (25 MB, up to 30 seconds). Media is optional.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-outline btn-sm min-h-11"
            onClick={() => {
              replaceImageIdRef.current = null;
              imageInputRef.current?.click();
            }}
            disabled={disabled || images.length >= 5}
          >
            <ImagePlus className="size-4" aria-hidden="true" />
            Add photos ({images.length}/5)
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm min-h-11"
            onClick={() => videoInputRef.current?.click()}
            disabled={disabled}
          >
            <Video className="size-4" aria-hidden="true" />
            {video ? "Replace video" : "Add video"}
          </button>
        </div>
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        aria-label="Choose listing photos"
        onChange={handleImagesSelected}
        disabled={disabled}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/webm"
        className="sr-only"
        aria-label="Choose listing video"
        onChange={handleVideoSelected}
        disabled={disabled}
      />

      {images.length === 0 && !video ? (
        <button
          type="button"
          className="flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-base-300 bg-base-200/60 px-3 py-4 text-center transition-colors hover:border-primary/50 hover:bg-base-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          onClick={() => imageInputRef.current?.click()}
          disabled={disabled}
          aria-label="Choose listing photos or add a video"
        >
          <Upload className="size-5 text-primary" aria-hidden="true" />
          <span className="text-sm font-medium">Choose photos or video</span>
          <span className="text-xs opacity-60">Images and video are optional</span>
        </button>
      ) : (
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((item, index) => (
            <article
              key={item.id}
              className="min-w-0 overflow-hidden rounded-xl border border-base-300 bg-base-200"
            >
              <div className="relative aspect-[4/3] bg-base-300">
                {item.previewUrl && (
                  <img
                    src={item.previewUrl}
                    alt={`Selected listing photo ${index + 1}`}
                    className="size-full object-cover"
                  />
                )}
                {index === 0 && (
                  <span className="badge badge-primary absolute left-2 top-2">
                    Primary photo
                  </span>
                )}
                {item.status === "validating" && (
                  <span className="absolute inset-0 flex items-center justify-center bg-base-100/65">
                    <LoaderCircle className="size-6 animate-spin" aria-label="Checking image" />
                  </span>
                )}
              </div>
              <div className="p-2.5">
                <UploadProgress item={item} />
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs min-h-10"
                    onClick={() => {
                      replaceImageIdRef.current = item.id;
                      imageInputRef.current?.click();
                    }}
                    disabled={disabled || item.status === "uploading" || item.status === "validating"}
                    aria-label={`Replace photo ${index + 1}`}
                  >
                    Replace
                  </button>
                  {item.status === "error" && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs min-h-10"
                      onClick={() => onReplaceImage(item.id, item.file)}
                      disabled={disabled}
                      aria-label={`Retry photo ${index + 1} upload`}
                    >
                      Retry
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-square btn-xs min-h-10 min-w-10"
                    onClick={() => onMoveImage(item.id, -1)}
                    disabled={disabled || index === 0 || item.status === "uploading"}
                    aria-label={`Move photo ${index + 1} earlier`}
                  >
                    <ArrowUp className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-square btn-xs min-h-10 min-w-10"
                    onClick={() => onMoveImage(item.id, 1)}
                    disabled={disabled || index === images.length - 1 || item.status === "uploading"}
                    aria-label={`Move photo ${index + 1} later`}
                  >
                    <ArrowDown className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-square btn-xs min-h-10 min-w-10 text-error"
                    onClick={() => onRemoveImage(item.id)}
                    disabled={disabled}
                    aria-label={`Remove photo ${index + 1}`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </article>
          ))}
          {video && (
            <article className="min-w-0 overflow-hidden rounded-xl border border-base-300 bg-base-200">
              <video
                src={video.previewUrl}
                controls
                playsInline
                preload="metadata"
                className="aspect-[4/3] w-full bg-black object-contain"
                aria-label="Selected listing video preview"
              />
              <div className="p-2.5">
                <p className="text-xs font-medium">Optional listing video</p>
                <UploadProgress item={video} />
                {video.status === "error" && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm mt-2 min-h-10"
                    onClick={() => onRetryVideo(video.file)}
                    disabled={disabled}
                  >
                    Retry video upload
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm min-h-10 mt-2"
                  onClick={() => onRemoveVideo()}
                  disabled={disabled}
                  aria-label="Remove listing video"
                >
                  <Trash2 className="size-4" aria-hidden="true" /> Remove video
                </button>
              </div>
            </article>
          )}
        </div>
      )}
      {errors.length > 0 && (
        <div className="space-y-2" aria-live="polite">
          {errors.map((error) => (
            <div
              key={error.id}
              className="alert alert-error flex items-start justify-between gap-3 py-2 text-sm"
            >
              <span className="min-w-0 break-words">
                <strong>{error.fileName}:</strong> {error.message}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-square btn-xs min-h-10 min-w-10 shrink-0"
                onClick={() => onDismissError(error.id)}
                aria-label={`Dismiss ${error.fileName} upload error`}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default MarketplaceMediaUploader;
