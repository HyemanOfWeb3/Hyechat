import { generateStreamToken, upsertStreamUser } from "../lib/stream.js";

export async function getStreamToken(req, res) {
  try {
    const token = generateStreamToken(req.user.id);

    res.status(200).json({ token });
  } catch (error) {
    console.log("error in getStreamToken controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function syncStreamUsers(req, res) {
  try {
    const users = Array.isArray(req.body?.users) ? req.body.users : [];
    const requestedUsers = users.filter((user) => user?.id);

    if (!requestedUsers.length) {
      return res.status(400).json({ message: "At least one user is required" });
    }

    const authenticatedUserId = String(req.user?._id || "");
    if (!authenticatedUserId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (
      requestedUsers.some(
        (user) => String(user.id) !== authenticatedUserId,
      )
    ) {
      return res
        .status(403)
        .json({ message: "Cannot sync another user's profile" });
    }

    const payload = {
      id: authenticatedUserId,
      name: req.user.fullName || authenticatedUserId,
      image: req.user.profilePic || "",
    };
    await upsertStreamUser(payload);

    return res.status(200).json({
      success: true,
      syncedUsers: [payload.id],
    });
  } catch (error) {
    console.log("error in syncStreamUsers controller", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

