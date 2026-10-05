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
import callHistoryRoutes from "./routes/callHistory.route.js";
import translationRoutes from "./routes/translation.route.js";

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
      return callback(new Error("Origin is not allowed by CORS"));
    },
    credentials: true,
  }),
);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

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
app.use("/api/call-history", callHistoryRoutes);

export default app;
