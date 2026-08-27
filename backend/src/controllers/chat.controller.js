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

    if (!users.length) {
      return res.status(400).json({ message: "At least one user is required" });
    }

    const syncedUsers = await Promise.all(
      users.map(async (user) => {
        if (!user?.id) return null;

        const payload = {
          id: String(user.id),
          name: user.name || String(user.id),
          image: user.image || "",
        };

        await upsertStreamUser(payload);
        return payload.id;
      }),
    );

    return res.status(200).json({
      success: true,
      syncedUsers: syncedUsers.filter(Boolean),
    });
  } catch (error) {
    console.log("error in syncStreamUsers controller", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
