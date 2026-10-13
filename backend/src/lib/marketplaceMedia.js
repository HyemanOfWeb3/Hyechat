import { head } from "@vercel/blob";
import { fileTypeFromBuffer } from "file-type";
import { imageSize } from "image-size";
import { parseBuffer } from "music-metadata";

export const MAX_MARKETPLACE_IMAGES = 5;
export const MAX_MARKETPLACE_IMAGE_SIZE = 5 * 1024 * 1024;
export const MAX_MARKETPLACE_VIDEO_SIZE = 25 * 1024 * 1024;
export const MAX_MARKETPLACE_VIDEO_DURATION_SECONDS = 30;
export const MAX_MARKETPLACE_IMAGE_DIMENSION = 8192;
export const MAX_MARKETPLACE_IMAGE_PIXELS = 40_000_000;

const imageTypes = {
  jpg: {
    extension: "jpg",
    mimeType: "image/jpeg",
    kind: "image",
    maxBytes: MAX_MARKETPLACE_IMAGE_SIZE,
  },
  jpeg: {
    extension: "jpeg",
    mimeType: "image/jpeg",
    kind: "image",
    maxBytes: MAX_MARKETPLACE_IMAGE_SIZE,
  },
  png: {
    extension: "png",
    mimeType: "image/png",
    kind: "image",
    maxBytes: MAX_MARKETPLACE_IMAGE_SIZE,
  },
  webp: {
    extension: "webp",
    mimeType: "image/webp",
    kind: "image",
    maxBytes: MAX_MARKETPLACE_IMAGE_SIZE,
  },
};

const videoTypes = {
  mp4: {
    extension: "mp4",
    mimeType: "video/mp4",
    kind: "video",
    maxBytes: MAX_MARKETPLACE_VIDEO_SIZE,
  },
  webm: {
    extension: "webm",
    mimeType: "video/webm",
    kind: "video",
    maxBytes: MAX_MARKETPLACE_VIDEO_SIZE,
  },
};

const mediaTypes = { ...imageTypes, ...videoTypes };
const randomFileName =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|jpeg|png|webp|mp4|webm)$/i;

export class MarketplaceMediaError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "MarketplaceMediaError";
    this.statusCode = statusCode;
  }
}

export const getMarketplacePendingMediaPath = (
  pathname,
  userId,
  expectedKind,
) => {
  if (typeof pathname !== "string" || typeof userId !== "string") {
    throw new MarketplaceMediaError("Invalid marketplace media path");
  }

  const prefix = `marketplace/pending/${userId}/`;
  if (!pathname.startsWith(prefix)) {
    throw new MarketplaceMediaError(
      "Marketplace media must belong to the current user",
      403,
    );
  }

  const filename = pathname.slice(prefix.length);
  if (!randomFileName.test(filename)) {
    throw new MarketplaceMediaError("Invalid marketplace media filename");
  }

  const extension = filename.slice(filename.lastIndexOf(".") + 1).toLowerCase();
  const type = mediaTypes[extension];
  if (!type || (expectedKind && type.kind !== expectedKind)) {
    throw new MarketplaceMediaError("Unsupported marketplace media type");
  }

  return { pathname, ...type };
};

export const getMarketplaceMediaPathFromUrl = (
  value,
  userId,
  expectedKind,
) => {
  if (typeof value !== "string" || !value.trim() || value.length > 2048) {
    throw new MarketplaceMediaError("Invalid marketplace media URL");
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new MarketplaceMediaError("Invalid marketplace media URL");
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash ||
    !url.hostname.endsWith(".public.blob.vercel-storage.com")
  ) {
    throw new MarketplaceMediaError(
      "Marketplace media must use the approved public storage",
    );
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname).replace(/^\//, "");
  } catch {
    throw new MarketplaceMediaError("Invalid marketplace media URL");
  }

  return {
    ...getMarketplacePendingMediaPath(pathname, userId, expectedKind),
    url: url.href,
  };
};

export const validateMarketplaceMediaMetadata = ({
  kind,
  size,
  declaredMimeType,
  detectedMimeType,
  width,
  height,
  duration,
}) => {
  const maxSize =
    kind === "image"
      ? MAX_MARKETPLACE_IMAGE_SIZE
      : kind === "video"
        ? MAX_MARKETPLACE_VIDEO_SIZE
        : 0;

  if (!maxSize || !Number.isSafeInteger(size) || size <= 0 || size > maxSize) {
    throw new MarketplaceMediaError(
      kind === "video"
        ? "Videos must be 25 MB or smaller"
        : "Images must be 5 MB or smaller",
    );
  }

  if (!Object.values(mediaTypes).some((type) => type.kind === kind && type.mimeType === detectedMimeType)) {
    throw new MarketplaceMediaError("Unsupported marketplace media content");
  }
  if (declaredMimeType !== detectedMimeType) {
    throw new MarketplaceMediaError(
      "The uploaded file content does not match its media type",
    );
  }

  if (kind === "image") {
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width <= 0 ||
      height <= 0 ||
      width > MAX_MARKETPLACE_IMAGE_DIMENSION ||
      height > MAX_MARKETPLACE_IMAGE_DIMENSION ||
      width * height > MAX_MARKETPLACE_IMAGE_PIXELS
    ) {
      throw new MarketplaceMediaError("Image dimensions are invalid or too large");
    }
  } else if (
    !Number.isFinite(duration) ||
    duration <= 0 ||
    duration > MAX_MARKETPLACE_VIDEO_DURATION_SECONDS
  ) {
    throw new MarketplaceMediaError("Videos must be 30 seconds or shorter");
  }
};

export const inspectMarketplaceMediaBuffer = async (
  buffer,
  { kind, declaredMimeType },
) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new MarketplaceMediaError("The uploaded media is empty or unreadable");
  }

  const maxSize =
    kind === "image"
      ? MAX_MARKETPLACE_IMAGE_SIZE
      : kind === "video"
        ? MAX_MARKETPLACE_VIDEO_SIZE
        : 0;
  if (buffer.length > maxSize) {
    throw new MarketplaceMediaError(
      kind === "video"
        ? "Videos must be 25 MB or smaller"
        : "Images must be 5 MB or smaller",
    );
  }

  const detected = await fileTypeFromBuffer(buffer);
  if (!detected) {
    throw new MarketplaceMediaError("The uploaded file is corrupt or unsupported");
  }

  if (kind === "image") {
    let dimensions;
    try {
      dimensions = imageSize(buffer);
    } catch {
      throw new MarketplaceMediaError("The uploaded image is corrupt or unreadable");
    }
    validateMarketplaceMediaMetadata({
      kind,
      size: buffer.length,
      declaredMimeType,
      detectedMimeType: detected.mime,
      width: dimensions.width,
      height: dimensions.height,
    });
    return { kind, contentType: detected.mime, ...dimensions };
  }

  let metadata;
  try {
    metadata = await parseBuffer(buffer, detected.mime, { duration: true });
  } catch {
    throw new MarketplaceMediaError("The uploaded video is corrupt or unreadable");
  }

  validateMarketplaceMediaMetadata({
    kind,
    size: buffer.length,
    declaredMimeType,
    detectedMimeType: detected.mime,
    duration: metadata.format.duration,
  });
  return {
    kind,
    contentType: detected.mime,
    duration: metadata.format.duration,
  };
};

export const verifyMarketplaceMediaUrl = async (
  value,
  userId,
  expectedKind,
  { headBlob = head, fetchBlob = fetch } = {},
) => {
  const media = getMarketplaceMediaPathFromUrl(value, userId, expectedKind);
  let blob;
  try {
    blob = await headBlob(media.url, { access: "public" });
  } catch {
    throw new MarketplaceMediaError(
      "Uploaded media could not be verified. Please upload again.",
      502,
    );
  }

  if (
    blob.pathname !== media.pathname ||
    blob.contentType !== media.mimeType ||
    !Number.isSafeInteger(blob.size) ||
    blob.size <= 0 ||
    blob.size > media.maxBytes
  ) {
    throw new MarketplaceMediaError("Uploaded media metadata is invalid");
  }

  let response;
  try {
    response = await fetchBlob(media.url, { signal: AbortSignal.timeout(30_000) });
  } catch {
    throw new MarketplaceMediaError(
      "Uploaded media could not be verified. Please upload again.",
      502,
    );
  }
  if (!response.ok) {
    throw new MarketplaceMediaError(
      "Uploaded media could not be verified. Please upload again.",
      502,
    );
  }

  let buffer;
  try {
    buffer = Buffer.from(await response.arrayBuffer());
  } catch {
    throw new MarketplaceMediaError("Uploaded media could not be read", 502);
  }
  if (buffer.length !== blob.size) {
    throw new MarketplaceMediaError("Uploaded media size could not be verified");
  }

  const inspected = await inspectMarketplaceMediaBuffer(buffer, {
    kind: media.kind,
    declaredMimeType: blob.contentType,
  });
  return { ...media, ...inspected, size: buffer.length };
};