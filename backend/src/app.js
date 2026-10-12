import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

import authRoutes from "./routes/auth.route.js";
import userRoutes from "./routes/user.route.js";
import chatRoutes from "./routes/chat.route.js";
import storyRoutes from "./routes/story.route.js";
import notificationRoutes from "./routes/notification.route.js";
import streamWebhookRoutes from "./routes/streamWebhook.route.js";
import communityRoutes from "./routes/community.route.js";
import marketplaceRoutes from "./routes/marketplace.route.js";
import searchRoutes from "./routes/search.route.js";
import callHistoryRoutes from "./routes/callHistory.route.js";
import translationRoutes from "./routes/translation.route.js";
import {
  getProfileOpenGraph,
  getProfileShareImage,
} from "./controllers/user.controller.js";

const app = express();
app.disable("x-powered-by");

const allowedOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin))
        return callback(null, true);
      const error = new Error("Origin is not allowed by CORS");
      error.status = 403;
      return callback(error);
    },
    credentials: true,
  }),
);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Dynamic Open Graph share preview & image endpoints
app.get("/api/og/profile/:userId", getProfileOpenGraph);
app.get("/api/og/image/:userId", getProfileShareImage);
app.get("/profile/:userId", getProfileOpenGraph);

app.use(
  "/api/webhooks/stream",
  express.raw({ type: "application/json" }),
  streamWebhookRoutes,
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/translation", translationRoutes);
app.use("/api/stories", storyRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/communities", communityRoutes);
app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/call-history", callHistoryRoutes);

app.use("/api", (_req, res) => {
  res.status(404).json({ message: "API route not found" });
});

app.use((error, _req, res, next) => {
  if (res.headersSent) return next(error);

  const requestedStatus = error?.statusCode || error?.status;
  const status =
    Number.isInteger(requestedStatus) && requestedStatus >= 400 && requestedStatus <= 599
      ? requestedStatus
      : 500;
  const message =
    status === 400
      ? "Invalid request"
      : status === 403
        ? "Forbidden"
        : status === 413
          ? "Request payload too large"
          : status === 429
            ? "Too many requests"
            : status >= 500
              ? "Internal Server Error"
              : "Request failed";

  if (status >= 500) {
    console.error("Unhandled request error", {
      status,
      errorType: error?.name || "Error",
    });
  }
  return res.status(status).json({ message });
});

export default app;
