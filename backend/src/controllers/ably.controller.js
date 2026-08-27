import { createNotificationTokenRequest } from "../lib/ably.js";

export async function createAblyTokenRequest(req, res) {
  try {
    const tokenRequest = await createNotificationTokenRequest(req.user._id);
    return res.status(200).json(tokenRequest);
  } catch (error) {
    console.error("Error creating Ably token request", error.message);
    return res.status(503).json({ message: "Realtime service unavailable" });
  }
}
