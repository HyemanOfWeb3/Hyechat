export const MAX_PROFILE_PICTURE_SIZE = 5 * 1024 * 1024;
export const PROFILE_PICTURE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const validateProfilePictureFile = (file) => {
  if (!file || !Number.isFinite(file.size) || file.size <= 0) {
    return "Choose a non-empty image file.";
  }
  if (!PROFILE_PICTURE_TYPES.includes(file.type)) {
    return "Please choose a JPG, PNG, or WebP image.";
  }
  if (file.size > MAX_PROFILE_PICTURE_SIZE) {
    return "Profile photos must be 5 MB or smaller.";
  }
  return "";
};

export const inspectProfilePictureFile = async (file) => {
  if (typeof globalThis.createImageBitmap === "function") {
    let bitmap;
    try {
      bitmap = await globalThis.createImageBitmap(file);
      if (!bitmap.width || !bitmap.height) {
        return "This image is corrupt or could not be read.";
      }
      return "";
    } catch {
      return "This image is corrupt or could not be read.";
    } finally {
      bitmap?.close?.();
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = objectUrl;
    });
    return image.naturalWidth > 0 && image.naturalHeight > 0
      ? ""
      : "This image is corrupt or could not be read.";
  } catch {
    return "This image is corrupt or could not be read.";
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};
