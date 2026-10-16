export const buildOnboardingPayload = (
  values,
  { profilePic, removePicture = false } = {},
) => {
  const payload = { ...values };
  if (typeof profilePic === "string" && profilePic.trim()) {
    payload.profilePic = profilePic.trim();
  } else if (removePicture) {
    payload.profilePic = "";
  } else {
    delete payload.profilePic;
  }
  return payload;
};

export const uploadOnboardingProfilePicture = async ({
  file,
  streamClient,
  userId,
  onProgress,
}) => {
  if (!streamClient || !userId || streamClient.userID !== userId) {
    throw new Error("Secure photo upload is not ready. Please try again.");
  }

  const response = await streamClient.uploadFile(
    file,
    file.name,
    file.type,
    undefined,
    {
      onUploadProgress: ({ loaded, total }) => {
        if (Number.isFinite(total) && total > 0) {
          onProgress?.(Math.min(100, Math.round((loaded / total) * 100)));
        }
      },
    },
  );
  if (!response?.file) {
    throw new Error("The photo upload did not return an image URL.");
  }
  return response.file;
};
