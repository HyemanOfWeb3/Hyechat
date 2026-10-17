import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { uploadPresigned } from "@vercel/blob/client";
import toast from "react-hot-toast";
import { cleanupMarketplaceMedia } from "../lib/api.js";
import {
  createMarketplacePendingPath,
  getMarketplaceMediaState,
  inspectMarketplaceImageDimensions,
  inspectMarketplaceVideoDuration,
  splitMarketplaceImageSelection,
  validateMarketplaceMediaSelection,
} from "../components/marketplace/marketplaceMedia.js";

const getUploadError = (error) =>
  error?.response?.data?.message ||
  error?.message ||
  "Upload failed. Please try again.";

export const useMarketplaceMedia = (userId) => {
  const [images, setImages] = useState([]);
  const [video, setVideo] = useState(null);
  const [errors, setErrors] = useState([]);
  const [activeValidations, setActiveValidations] = useState(0);
  const imagesRef = useRef([]);
  const videoRef = useRef(null);
  const uploadControllersRef = useRef(new Map());
  const uploadPromisesRef = useRef(new Map());
  const imageReservationsRef = useRef(0);
  const videoSelectionInProgressRef = useRef(false);
  const selectionGenerationRef = useRef(0);
  const mountedRef = useRef(false);

  const updateImages = useCallback((updater) => {
    const next =
      typeof updater === "function" ? updater(imagesRef.current) : updater;
    imagesRef.current = next;
    if (mountedRef.current) setImages(next);
  }, []);

  const updateVideo = useCallback((next) => {
    videoRef.current = next;
    if (mountedRef.current) setVideo(next);
  }, []);

  const addError = useCallback((file, message) => {
    const error = {
      id: crypto.randomUUID(),
      fileName: file?.name || "Selected file",
      message,
    };
    if (mountedRef.current) setErrors((current) => [...current, error]);
    return error;
  }, []);

  const cleanupPaths = useCallback(async (paths) => {
    const uniquePaths = [...new Set(paths.filter(Boolean))];
    if (!uniquePaths.length) return { failedPaths: [] };

    try {
      const result = await cleanupMarketplaceMedia(uniquePaths);
      if (result.failedPaths?.length) {
        toast.error(
          "Some unused uploads could not be cleaned up. Please retry or contact support.",
        );
      }
      return result;
    } catch (error) {
      console.error("Marketplace media cleanup failed:", error);
      toast.error(
        "Unused media cleanup failed. Please retry or contact support.",
      );
      return { failedPaths: uniquePaths };
    }
  }, []);

  const prepareItem = useCallback(async (file, kind) => {
    const basicError = validateMarketplaceMediaSelection(file, kind);
    if (basicError) return { error: basicError };

    const previewUrl = URL.createObjectURL(file);
    if (kind === "image") {
      const dimensionError = await inspectMarketplaceImageDimensions(file);
      if (dimensionError || !mountedRef.current) {
        URL.revokeObjectURL(previewUrl);
        return { error: dimensionError, cancelled: !mountedRef.current };
      }
      return {
        item: {
          id: crypto.randomUUID(),
          kind,
          file,
          previewUrl,
          status: "validating",
          progress: 0,
          path: "",
          url: "",
          error: "",
        },
      };
    }

    try {
      const videoInfo = await inspectMarketplaceVideoDuration(file);
      if (videoInfo.error || !mountedRef.current) {
        URL.revokeObjectURL(previewUrl);
        return { error: videoInfo.error, cancelled: !mountedRef.current };
      }
      return {
        item: {
          id: crypto.randomUUID(),
          kind,
          file,
          previewUrl,
          duration: videoInfo.duration,
          status: "validating",
          progress: 0,
          path: "",
          url: "",
          error: "",
        },
      };
    } catch (error) {
      URL.revokeObjectURL(previewUrl);
      return { error: getUploadError(error) };
    }
  }, []);

  const updateItem = useCallback(
    (itemId, patch) => {
      const merge = (item) =>
        item?.id === itemId ? { ...item, ...patch } : item;
      const currentVideo = videoRef.current;
      if (currentVideo?.id === itemId) {
        updateVideo(merge(currentVideo));
        return;
      }
      updateImages((current) => current.map(merge));
    },
    [updateImages, updateVideo],
  );

  const startUpload = useCallback(
    (item) => {
      if (!userId) {
        updateItem(item.id, {
          status: "error",
          error: "Sign in before uploading media.",
        });
        return Promise.resolve(null);
      }

      const path = createMarketplacePendingPath(
        userId,
        item.id,
        item.file.type,
      );
      const controller = new AbortController();
      uploadControllersRef.current.set(item.id, controller);
      updateItem(item.id, {
        path,
        status: "uploading",
        progress: 0,
        error: "",
      });

      const task = uploadPresigned(path, item.file, {
        access: "public",
        handleUploadUrl: "/api/marketplace/media/upload",
        clientPayload: JSON.stringify({ kind: item.kind }),
        contentType: item.file.type,
        abortSignal: controller.signal,
        onUploadProgress: ({ percentage }) => {
          if (Number.isFinite(percentage)) {
            updateItem(item.id, { progress: percentage });
          }
        },
      })
        .then((blob) => {
          if (!blob?.url || blob.pathname !== path) {
            throw new Error("Storage returned an unexpected media path.");
          }
          updateItem(item.id, {
            status: "uploaded",
            progress: 100,
            url: blob.url,
            error: "",
          });
          return blob;
        })
        .catch((error) => {
          if (!controller.signal.aborted) {
            updateItem(item.id, {
              status: "error",
              progress: 0,
              error: getUploadError(error),
            });
          }
          return null;
        })
        .finally(() => {
          uploadControllersRef.current.delete(item.id);
          uploadPromisesRef.current.delete(item.id);
        });

      uploadPromisesRef.current.set(item.id, task);
      return task;
    },
    [updateItem, userId],
  );

  const releaseItems = useCallback(
    async (items, { cleanup = true } = {}) => {
      const pending = items.map(async (item) => {
        uploadControllersRef.current.get(item.id)?.abort();
        await uploadPromisesRef.current.get(item.id)?.catch(() => null);
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      await Promise.all(pending);
      if (cleanup) await cleanupPaths(items.map((item) => item.path));
    },
    [cleanupPaths],
  );

  const addImages = useCallback(
    async (files) => {
      const generation = selectionGenerationRef.current;
      const { accepted: acceptedFiles, rejected: rejectedFiles } =
        splitMarketplaceImageSelection(
          files,
          imagesRef.current.length,
          imageReservationsRef.current,
        );
      imageReservationsRef.current += acceptedFiles.length;
      let reservationHeld = true;
      setActiveValidations((count) => count + acceptedFiles.length);

      for (const file of rejectedFiles) {
        addError(file, "You can add up to 5 photos.");
      }

      try {
        const prepared = await Promise.all(
          acceptedFiles.map((file) => prepareItem(file, "image")),
        );
        if (
          !mountedRef.current ||
          generation !== selectionGenerationRef.current
        ) {
          prepared.forEach((result) => {
            if (result.item?.previewUrl)
              URL.revokeObjectURL(result.item.previewUrl);
          });
          return;
        }
        const readyItems = [];
        prepared.forEach((result, index) => {
          if (result.cancelled) return;
          if (result.error) addError(acceptedFiles[index], result.error);
          else readyItems.push(result.item);
        });
        if (readyItems.length) {
          if (!mountedRef.current) {
            readyItems.forEach((item) => URL.revokeObjectURL(item.previewUrl));
            return;
          }
          updateImages((current) => [...current, ...readyItems]);
        }
        imageReservationsRef.current = Math.max(
          0,
          imageReservationsRef.current - acceptedFiles.length,
        );
        reservationHeld = false;
        if (!readyItems.length) return;
        await Promise.all(readyItems.map(startUpload));
      } finally {
        if (reservationHeld && generation === selectionGenerationRef.current) {
          imageReservationsRef.current = Math.max(
            0,
            imageReservationsRef.current - acceptedFiles.length,
          );
        }
        if (mountedRef.current) {
          setActiveValidations((count) =>
            Math.max(0, count - acceptedFiles.length),
          );
        }
      }
    },
    [addError, prepareItem, startUpload, updateImages],
  );

  const replaceImage = useCallback(
    async (itemId, file) => {
      const generation = selectionGenerationRef.current;
      const oldItems = imagesRef.current;
      const oldIndex = oldItems.findIndex((item) => item.id === itemId);
      if (oldIndex < 0) return;

      setActiveValidations((count) => count + 1);
      try {
        const { item, error } = await prepareItem(file, "image");
        if (
          error ||
          !mountedRef.current ||
          generation !== selectionGenerationRef.current
        ) {
          if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
          if (
            !mountedRef.current ||
            generation !== selectionGenerationRef.current
          )
            return;
          addError(file, error);
          return;
        }

        const oldItem = oldItems[oldIndex];
        await releaseItems([oldItem]);
        if (
          !mountedRef.current ||
          generation !== selectionGenerationRef.current ||
          !imagesRef.current.some((candidate) => candidate.id === itemId)
        ) {
          URL.revokeObjectURL(item.previewUrl);
          return;
        }
        let replaced = false;
        updateImages((current) => {
          const index = current.findIndex(
            (candidate) => candidate.id === itemId,
          );
          if (index < 0) return current;
          const next = [...current];
          next.splice(index, 1, item);
          replaced = true;
          return next;
        });
        if (!replaced) {
          URL.revokeObjectURL(item.previewUrl);
          return;
        }
        await startUpload(item);
      } finally {
        if (mountedRef.current) {
          setActiveValidations((count) => Math.max(0, count - 1));
        }
      }
    },
    [addError, prepareItem, releaseItems, startUpload, updateImages],
  );

  const removeImage = useCallback(
    async (itemId) => {
      const item = imagesRef.current.find(
        (candidate) => candidate.id === itemId,
      );
      if (!item) return;
      updateImages((current) =>
        current.filter((candidate) => candidate.id !== itemId),
      );
      await releaseItems([item]);
    },
    [releaseItems, updateImages],
  );

  const moveImage = useCallback(
    (itemId, offset) => {
      updateImages((current) => {
        const from = current.findIndex((item) => item.id === itemId);
        const to = from + offset;
        if (from < 0 || to < 0 || to >= current.length) return current;
        const next = [...current];
        [next[from], next[to]] = [next[to], next[from]];
        return next;
      });
    },
    [updateImages],
  );

  const addVideo = useCallback(
    async (file) => {
      if (videoSelectionInProgressRef.current) return;
      const generation = selectionGenerationRef.current;
      videoSelectionInProgressRef.current = true;
      setActiveValidations((count) => count + 1);
      try {
        const { item, error } = await prepareItem(file, "video");
        if (
          error ||
          !mountedRef.current ||
          generation !== selectionGenerationRef.current
        ) {
          if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
          if (
            !mountedRef.current ||
            generation !== selectionGenerationRef.current
          )
            return;
          addError(file, error);
          return;
        }
        const previous = videoRef.current;
        if (previous) await releaseItems([previous]);
        if (
          !mountedRef.current ||
          generation !== selectionGenerationRef.current
        ) {
          URL.revokeObjectURL(item.previewUrl);
          return;
        }
        updateVideo(item);
        void startUpload(item);
      } finally {
        videoSelectionInProgressRef.current = false;
        if (mountedRef.current) {
          setActiveValidations((count) => Math.max(0, count - 1));
        }
      }
    },
    [addError, prepareItem, releaseItems, startUpload, updateVideo],
  );

  const removeVideo = useCallback(async () => {
    const item = videoRef.current;
    if (!item) return;
    updateVideo(null);
    await releaseItems([item]);
  }, [releaseItems, updateVideo]);

  const setExistingMedia = useCallback(
    ({ imageUrls = [], videoUrl = "" } = {}) => {
      updateImages(
        imageUrls.map((url, index) => ({
          id: `existing-image-${index}`,
          kind: "image",
          file: { name: `Existing photo ${index + 1}` },
          previewUrl: url,
          status: "uploaded",
          progress: 100,
          path: "",
          url,
          error: "",
        })),
      );
      updateVideo(
        videoUrl
          ? {
              id: "existing-video",
              kind: "video",
              file: { name: "Existing listing video" },
              previewUrl: videoUrl,
              status: "uploaded",
              progress: 100,
              path: "",
              url: videoUrl,
              error: "",
            }
          : null,
      );
      setErrors([]);
    },
    [updateImages, updateVideo],
  );

  const clearError = useCallback((errorId) => {
    setErrors((current) => current.filter((error) => error.id !== errorId));
  }, []);

  const resetMedia = useCallback(
    async ({ cleanup = true } = {}) => {
      selectionGenerationRef.current += 1;
      const allItems = [
        ...imagesRef.current,
        ...(videoRef.current ? [videoRef.current] : []),
      ];
      updateImages([]);
      updateVideo(null);
      imageReservationsRef.current = 0;
      setErrors([]);
      await releaseItems(allItems, { cleanup });
    },
    [releaseItems, updateImages, updateVideo],
  );

  useEffect(() => {
    mountedRef.current = true;
    const uploadControllers = uploadControllersRef.current;
    const uploadPromises = uploadPromisesRef.current;
    return () => {
      mountedRef.current = false;
      selectionGenerationRef.current += 1;
      const allItems = [
        ...imagesRef.current,
        ...(videoRef.current ? [videoRef.current] : []),
      ];
      for (const item of allItems) {
        uploadControllers.get(item.id)?.abort();
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
      void Promise.all(
        allItems.map((item) => uploadPromises.get(item.id)?.catch(() => null)),
      ).then(() => cleanupPaths(allItems.map((item) => item.path)));
    };
  }, [cleanupPaths]);

  const allItems = useMemo(
    () => [...images, ...(video ? [video] : [])],
    [images, video],
  );
  const { hasUploadError, isReady, hasPendingUpload } = useMemo(
    () =>
      getMarketplaceMediaState({ images, video, errors, activeValidations }),
    [images, video, errors, activeValidations],
  );

  const cleanupUnattached = useCallback(async () => {
    const paths = allItems.map((item) => item.path).filter(Boolean);
    const result = paths.length
      ? await cleanupPaths(paths)
      : { failedPaths: [] };
    if (result.failedPaths?.length) return false;
    await resetMedia({ cleanup: false });
    return true;
  }, [allItems, cleanupPaths, resetMedia]);

  const releasePreviews = useCallback(async () => {
    await resetMedia({ cleanup: false });
  }, [resetMedia]);

  return {
    images,
    video,
    errors,
    isReady,
    hasPendingUpload,
    hasUploadError,
    addImages,
    replaceImage,
    removeImage,
    moveImage,
    addVideo,
    removeVideo,
    setExistingMedia,
    clearError,
    resetMedia,
    cleanupUnattached,
    releasePreviews,
  };
};
