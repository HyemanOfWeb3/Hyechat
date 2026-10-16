export const MARKETPLACE_MEDIA_LIMITS = {
  image: { maxCount: 5, maxBytes: 5 * 1024 * 1024 },
  video: { maxCount: 1, maxBytes: 25 * 1024 * 1024, maxDuration: 30 },
};

export const splitMarketplaceImageSelection = (
  files,
  currentCount,
  reservedCount = 0,
) => {
  const selectedFiles = Array.from(files || []);
  const available = Math.max(
    0,
    MARKETPLACE_MEDIA_LIMITS.image.maxCount - currentCount - reservedCount,
  );
  return {
    accepted: selectedFiles.slice(0, available),
    rejected: selectedFiles.slice(available),
  };
};

export const getMarketplaceMediaState = ({
  images = [],
  video = null,
  errors = [],
  activeValidations = 0,
}) => {
  const allItems = [...images, ...(video ? [video] : [])];
  const hasUploadError =
    errors.length > 0 || allItems.some((item) => item.status === "error");
  return {
    hasUploadError,
    isReady:
      activeValidations === 0 &&
      !hasUploadError &&
      allItems.every((item) => item.status === "uploaded"),
    hasPendingUpload:
      activeValidations > 0 ||
      allItems.some(
        (item) => item.status === "validating" || item.status === "uploading",
      ),
  };
};

export const getMarketplaceListingImages = (listing) =>
  listing?.imageUrls?.length
    ? listing.imageUrls
    : listing?.imageUrl
      ? [listing.imageUrl]
      : [];

const mediaTypes = {
  "image/jpeg": { extension: "jpg", kind: "image" },
  "image/png": { extension: "png", kind: "image" },
  "image/webp": { extension: "webp", kind: "image" },
  "video/mp4": { extension: "mp4", kind: "video" },
  "video/webm": { extension: "webm", kind: "video" },
};

export const validateMarketplaceMediaSelection = (file, kind) => {
  if (!file || !Number.isFinite(file.size) || file.size <= 0) {
    return "Choose a non-empty file.";
  }

  const mediaType = mediaTypes[file.type];
  if (!mediaType || mediaType.kind !== kind) {
    return kind === "video"
      ? "Choose an MP4 or WebM video."
      : "Choose a JPEG, PNG, or WebP image.";
  }

  if (file.size > MARKETPLACE_MEDIA_LIMITS[kind].maxBytes) {
    return kind === "video"
      ? "Videos must be 25 MB or smaller."
      : "Images must be 5 MB or smaller.";
  }

  return "";
};

export const createMarketplacePendingPath = (userId, uploadId, mimeType) => {
  const mediaType = mediaTypes[mimeType];
  if (
    typeof userId !== "string" ||
    !/^[a-f\d]{24}$/i.test(userId) ||
    typeof uploadId !== "string" ||
    !/^[\da-f-]{36}$/i.test(uploadId) ||
    !mediaType
  ) {
    throw new Error("Cannot prepare this marketplace upload.");
  }

  return `marketplace/pending/${userId}/${uploadId}.${mediaType.extension}`;
};

export const validateMarketplaceImageDimensions = ({ width, height }) => {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width > 8192 ||
    height > 8192 ||
    width * height > 40_000_000
  ) {
    return "Images must be readable and no larger than 8192 pixels per side or 40 megapixels.";
  }
  return "";
};

export const inspectMarketplaceImageDimensions = async (file) => {
  if (typeof createImageBitmap === "function") {
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
      return validateMarketplaceImageDimensions(bitmap);
    } catch {
      return "This image is corrupt or could not be read.";
    } finally {
      bitmap?.close?.();
    }
  }

  const temporaryUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    const dimensions = await new Promise((resolve, reject) => {
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error("Could not decode image"));
      image.src = temporaryUrl;
    });
    return validateMarketplaceImageDimensions(dimensions);
  } catch {
    return "This image is corrupt or could not be read.";
  } finally {
    URL.revokeObjectURL(temporaryUrl);
  }
};

export const inspectMarketplaceVideoDuration = (file) =>
  new Promise((resolve, reject) => {
    const temporaryUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      URL.revokeObjectURL(temporaryUrl);
      video.removeAttribute("src");
      video.load();
      callback(value);
    };
    const timeoutId = window.setTimeout(
      () => finish(reject, new Error("Video metadata could not be read.")),
      12_000,
    );

    video.preload = "metadata";
    video.onloadedmetadata = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        finish(reject, new Error("This video has an invalid duration."));
        return;
      }
      if (video.duration > MARKETPLACE_MEDIA_LIMITS.video.maxDuration) {
        finish(resolve, {
          error: "Videos must be 30 seconds or shorter.",
        });
        return;
      }
      finish(resolve, { duration: video.duration, error: "" });
    };
    video.onerror = () =>
      finish(reject, new Error("This video is corrupt or could not be read."));
    video.src = temporaryUrl;
  });