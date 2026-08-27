import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();
const uri = process.env.MONGO_URI;

if (!uri) {
  console.error("MONGO_URI not found in environment");
  process.exit(1);
}

const run = async () => {
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log("Connected to MongoDB host:", conn.connection.host);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Connection failed:", err);
    process.exit(1);
  }
};

run();
