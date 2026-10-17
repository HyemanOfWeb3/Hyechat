import { del, head, issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned } from "@vercel/blob/client";
import Community from "../models/Community.js";
import MarketplaceListing from "../models/MarketplaceListing.js";
import Story from "../models/Story.js";
import User from "../models/User.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  getMarketplacePendingMediaPath,
  MarketplaceMediaError,
  validateMarketplaceUploadCompletion,
} from "../lib/marketplaceMedia.js";

const MAX_MEDIA_PER_CLEANUP = 6;
const CLIENT_UPLOAD_TOKEN_TTL_MS = 15 * 60 * 1000;

const hasBlobConfiguration = () =>
  Boolean(
    process.env.BLOB_STORE_ID &&
    process.env.BLOB_WEBHOOK_PUBLIC_KEY &&
    (process.env.VERCEL_OIDC_TOKEN || process.env.BLOB_READ_WRITE_TOKEN),
  );

export const authenticateMarketplaceUploadRequest = (req, res, next) => {
  if (req.body?.type === "blob.upload-completed") return next();
  return protectRoute(req, res, next);
};

export async function handleMarketplaceMediaUpload(req, res) {
  if (!hasBlobConfiguration()) {
    return res.status(503).json({
      message: "Marketplace media storage is not configured",
    });
  }

  try {
    const result = await handleUploadPresigned({
      body: req.body,
      request: req,
      webhookPublicKey: process.env.BLOB_WEBHOOK_PUBLIC_KEY,
      getSignedToken: async (requestedPath, clientPayload) => {
        let payload;
        try {
          payload = JSON.parse(clientPayload || "{}");
        } catch {
          throw new MarketplaceMediaError("Invalid marketplace upload details");
        }
        const media = getMarketplacePendingMediaPath(
          requestedPath,
          req.user._id.toString(),
          payload.kind,
        );
        const validUntil = Date.now() + CLIENT_UPLOAD_TOKEN_TTL_MS;
        const constraints = {
          allowedContentTypes: [media.mimeType],
          maximumSizeInBytes: media.maxBytes,
          validUntil,
        };
        const token = await issueSignedToken({
          pathname: media.pathname,
          operations: ["put"],
          ...constraints,
        });

        return {
          token,
          urlOptions: {
            access: "public",
            ...constraints,
            addRandomSuffix: false,
            allowOverwrite: false,
            cacheControlMaxAge: 30 * 24 * 60 * 60,
            tokenPayload: JSON.stringify({
              userId: req.user._id.toString(),
              kind: media.kind,
              pathname: media.pathname,
            }),
          },
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        try {
          await validateMarketplaceUploadCompletion({ blob, tokenPayload });
        } catch (error) {
          try {
            if (blob.etag && !(await isMarketplaceMediaReferenced(blob.url))) {
              await del(blob.url, { access: "public", ifMatch: blob.etag });
            }
          } catch (cleanupError) {
            console.warn("Could not remove rejected Marketplace media", {
              errorType: cleanupError?.name || "Error",
            });
          }
          throw error;
        }
      },
    });

    return res.status(200).json(result);
  } catch (error) {
    return res.status(error?.statusCode || 400).json({
      message: error?.message || "Unable to authorize marketplace upload",
    });
  }
}

export const isMarketplaceMediaReferenced = async (
  url,
  {
    listingModel = MarketplaceListing,
    storyModel = Story,
    userModel = User,
    communityModel = Community,
  } = {},
) => {
  const references = await Promise.all([
    listingModel.exists({
      $or: [{ imageUrls: url }, { imageUrl: url }, { videoUrl: url }],
    }),
    storyModel.exists({ mediaUrl: url }),
    userModel.exists({ profilePic: url }),
    communityModel.exists({ avatar: url }),
  ]);
  return references.some(Boolean);
};

export async function cleanupMarketplaceMedia(req, res) {
  const paths = req.body?.paths;
  if (
    !Array.isArray(paths) ||
    paths.length > MAX_MEDIA_PER_CLEANUP ||
    paths.some((path) => typeof path !== "string")
  ) {
    return res.status(400).json({
      message: `Provide up to ${MAX_MEDIA_PER_CLEANUP} marketplace media paths`,
    });
  }
  if (!hasBlobConfiguration()) {
    return res.status(503).json({
      message: "Marketplace media storage is not configured",
    });
  }

  const userId = req.user._id.toString();
  const deletedPaths = [];
  const skippedPaths = [];
  const failedPaths = [];

  for (const path of [...new Set(paths)]) {
    try {
      const media = getMarketplacePendingMediaPath(path, userId);
      let blob;
      try {
        blob = await head(media.pathname, { access: "public" });
      } catch (error) {
        if (error?.status === 404 || error?.name === "BlobNotFoundError") {
          skippedPaths.push(path);
          continue;
        }
        throw error;
      }

      if (
        blob.pathname !== media.pathname ||
        (await isMarketplaceMediaReferenced(blob.url))
      ) {
        skippedPaths.push(path);
        continue;
      }

      await del(blob.url, { access: "public", ifMatch: blob.etag });
      deletedPaths.push(path);
    } catch (error) {
      console.warn("Could not clean up pending Marketplace media", {
        errorType: error?.name || "Error",
      });
      failedPaths.push(path);
    }
  }

  return res.status(failedPaths.length ? 207 : 200).json({
    deletedPaths,
    skippedPaths,
    failedPaths,
  });
}
