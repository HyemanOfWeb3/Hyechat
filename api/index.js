import app from "../backend/src/app.js";
import { connectDB } from "../backend/src/lib/db.js";

export default async function handler(req, res) {
  const requestPath = new URL(req.url, "http://vercel.local").pathname;

  if (requestPath !== "/health") {
    try {
      await connectDB();
    } catch (error) {
      console.error("Database connection failed", error.message);
      return res.status(503).json({ message: "Database unavailable" });
    }
  }

  return app(req, res);
}
