import mongoose from "mongoose";

const cached = globalThis.__hyechatMongo || {
  connection: null,
  promise: null,
};

globalThis.__hyechatMongo = cached;

export const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing");
  }

  if (cached.connection) return cached.connection;

  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
  }

  try {
    cached.connection = await cached.promise;
    console.log(`MongoDB Connected: ${cached.connection.connection.host}`);
  } catch (error) {
    cached.promise = null;
    throw error;
  }

  return cached.connection;
};
