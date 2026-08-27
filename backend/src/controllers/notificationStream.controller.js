import { addNotificationConnection } from "../lib/notificationStream.js";

export function streamNotifications(req, res) {
  res.status(200);
  res.set({
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Content-Type": "text/event-stream",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  res.write(": connected\n\n");

  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 30000);
  const removeConnection = addNotificationConnection(req.user._id, res);

  req.on("close", () => {
    clearInterval(heartbeat);
    removeConnection();
  });
}
