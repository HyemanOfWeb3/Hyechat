import mongoose from "mongoose";
import CallHistory from "../models/CallHistory.js";
import User from "../models/User.js";

const allowedTypes = new Set(["voice", "video"]);

const publicCall = (call) => ({
  ...call.toObject(),
  hiddenFor: undefined,
});

export async function startCallHistory(req, res) {
  const {
    roomId,
    callType = "video",
    participantIds = [],
    answered = true,
  } = req.body || {};
  if (
    typeof roomId !== "string" ||
    !roomId.trim() ||
    !allowedTypes.has(callType)
  )
    return res.status(400).json({ message: "Invalid call details" });

  const ids = [
    ...new Set([
      req.user._id.toString(),
      ...(Array.isArray(participantIds) ? participantIds : []),
    ]),
  ];
  if (ids.some((id) => !mongoose.isValidObjectId(id)))
    return res.status(400).json({ message: "Invalid call participant" });

  try {
    const call = await CallHistory.findOneAndUpdate(
      { roomId: roomId.trim() },
      {
        $setOnInsert: {
          roomId: roomId.trim(),
          caller: req.user._id,
          participants: ids,
          callType,
          startedAt: new Date(),
          provider: "stream-video",
        },
        $set: {
          status: answered ? "completed" : "outgoing",
          ...(answered ? { answeredAt: new Date() } : {}),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).populate("caller participants", "fullName profilePic");
    return res.status(200).json({ success: true, call: publicCall(call) });
  } catch (error) {
    console.error("Error starting call history", error.message);
    return res.status(500).json({ message: "Unable to save call history" });
  }
}

export async function endCallHistory(req, res) {
  const { roomId } = req.params;
  if (!roomId)
    return res.status(400).json({ message: "Call room is required" });
  try {
    const call = await CallHistory.findOne({
      roomId,
      participants: req.user._id,
    });
    if (!call)
      return res.status(404).json({ message: "Call history not found" });
    if (!call.endedAt) {
      call.endedAt = new Date();
      call.duration = call.answeredAt
        ? Math.max(0, Math.floor((call.endedAt - call.answeredAt) / 1000))
        : 0;
      call.status = call.answeredAt ? "completed" : "cancelled";
      await call.save();
    }
    return res.status(200).json({ success: true, call: publicCall(call) });
  } catch (error) {
    console.error("Error ending call history", error.message);
    return res.status(500).json({ message: "Unable to update call history" });
  }
}

export async function getCallHistory(req, res) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(
    50,
    Math.max(1, Number.parseInt(req.query.limit, 10) || 20),
  );
  const search =
    typeof req.query.search === "string" ? req.query.search.trim() : "";
  const filter = {
    participants: req.user._id,
    hiddenFor: { $ne: req.user._id },
  };
  if (["outgoing", "completed", "cancelled"].includes(req.query.status))
    filter.status = req.query.status;
  if (["voice", "video"].includes(req.query.callType))
    filter.callType = req.query.callType;
  try {
    if (search) {
      const escapedSearch = search
        .slice(0, 100)
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const matchingUsers = await User.find({
        fullName: { $regex: escapedSearch, $options: "i" },
      })
        .select("_id")
        .limit(100)
        .lean();
      delete filter.participants;
      filter.$and = [
        { participants: req.user._id },
        {
          participants: {
            $in: matchingUsers.map((user) => user._id),
          },
        },
      ];
    }
    const query = CallHistory.find(filter)
      .populate("caller participants", "fullName profilePic")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    const calls = await query;
    return res
      .status(200)
      .json({
        calls: calls.map(publicCall),
        page,
        limit,
        hasMore: calls.length === limit,
      });
  } catch (error) {
    console.error("Error loading call history", error.message);
    return res.status(500).json({ message: "Unable to load call history" });
  }
}

export async function deleteCallHistory(req, res) {
  try {
    const call = await CallHistory.findOneAndUpdate(
      { _id: req.params.id, participants: req.user._id },
      { $addToSet: { hiddenFor: req.user._id } },
      { new: true },
    );
    if (!call)
      return res.status(404).json({ message: "Call history not found" });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error deleting call history", error.message);
    return res.status(500).json({ message: "Unable to delete call history" });
  }
}
