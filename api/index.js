import app from "../backend/src/app.js";
import { checkDB, connectDB } from "../backend/src/lib/db.js";

export default async function handler(req, res) {
  const requestPath = new URL(req.url, "http://vercel.local").pathname;

  if (requestPath === "/health") {
    try {
      await checkDB();
    } catch (error) {
      console.error("Database health check failed", error.name || "Error");
      return res.status(503).json({ message: "Database unavailable" });
    }
  } else {
    try {
      await connectDB();
    } catch (error) {
      console.error("Database connection failed", error.name || "Error");
      return res.status(503).json({ message: "Database unavailable" });
    }
  }

  return app(req, res);
}
