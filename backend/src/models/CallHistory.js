import mongoose from "mongoose";

const callHistorySchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, unique: true, index: true },
    caller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    participants: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ],
    callType: { type: String, enum: ["voice", "video"], required: true },
    status: {
      type: String,
      enum: ["outgoing", "completed", "cancelled"],
      default: "outgoing",
    },
    startedAt: { type: Date, default: Date.now },
    answeredAt: Date,
    endedAt: Date,
    duration: { type: Number, default: 0, min: 0 },
    provider: { type: String, default: "stream-video" },
    hiddenFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true },
);

callHistorySchema.index({ participants: 1, createdAt: -1 });
callHistorySchema.index({ participants: 1, status: 1, createdAt: -1 });

export default mongoose.model("CallHistory", callHistorySchema);
