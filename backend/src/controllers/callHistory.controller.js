import mongoose from "mongoose";
import CallHistory from "../models/CallHistory.js";
import User from "../models/User.js";
import { getStreamVideoCallSnapshot } from "../lib/streamVideo.js";

const allowedTypes = new Set(["voice", "video"]);
const MAX_ROOM_ID_LENGTH = 128;

const publicCall = (call) => ({
  ...call.toObject(),
  hiddenFor: undefined,
});

export async function startCallHistory(req, res) {
  const { roomId, callType = "video" } = req.body || {};
  if (
    typeof roomId !== "string" ||
    !roomId.trim() ||
    roomId.trim().length > MAX_ROOM_ID_LENGTH ||
    !allowedTypes.has(callType)
  )
    return res.status(400).json({ message: "Invalid call details" });

  try {
    let providerCall;
    try {
      providerCall = await getStreamVideoCallSnapshot(roomId.trim());
    } catch {
      return res
        .status(503)
        .json({ message: "Unable to verify call participants" });
    }

    const authenticatedUserId = req.user._id.toString();
    if (!providerCall.memberIds.includes(authenticatedUserId)) {
      return res.status(403).json({ message: "You are not a member of this call" });
    }
    if (
      !providerCall.creatorId ||
      !mongoose.isValidObjectId(providerCall.creatorId)
    ) {
      return res
        .status(502)
        .json({ message: "Call participant data is invalid" });
    }

    const participantIds = [...new Set(providerCall.memberIds)].filter(
      mongoose.isValidObjectId,
    );
    if (!participantIds.includes(authenticatedUserId)) {
      return res.status(403).json({ message: "You are not a member of this call" });
    }

    const activeParticipantIds = providerCall.activeParticipantIds.filter(
      (participantId) => participantIds.includes(participantId),
    );
    const answered = new Set(activeParticipantIds).size > 1;
    const existingCall = await CallHistory.findOne({ roomId: roomId.trim() });
    if (existingCall?.endedAt) {
      return res.status(409).json({ message: "Call history has already ended" });
    }

    const now = new Date();
    const update = {
      caller: new mongoose.Types.ObjectId(providerCall.creatorId),
      participants: participantIds.map((id) => new mongoose.Types.ObjectId(id)),
      callType,
      startedAt: existingCall?.startedAt || now,
      provider: "stream-video",
      status: answered || existingCall?.answeredAt ? "completed" : "outgoing",
      ...(answered || existingCall?.answeredAt
        ? { answeredAt: existingCall?.answeredAt || now }
        : {}),
    };
    const call = await CallHistory.findOneAndUpdate(
      { roomId: roomId.trim() },
      { $set: { roomId: roomId.trim(), ...update } },
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
  if (typeof roomId !== "string" || !roomId.trim() || roomId.length > MAX_ROOM_ID_LENGTH)
    return res.status(400).json({ message: "Call room is required" });
  try {
    let providerCall;
    try {
      providerCall = await getStreamVideoCallSnapshot(roomId);
    } catch {
      return res
        .status(503)
        .json({ message: "Unable to verify call participants" });
    }
    if (!providerCall.memberIds.includes(req.user._id.toString())) {
      return res.status(403).json({ message: "You are not a member of this call" });
    }

    const call = await CallHistory.findOne({ roomId });
    if (!call)
      return res.status(404).json({ message: "Call history not found" });

    const activeParticipantIds = providerCall.activeParticipantIds.filter(
      (participantId) => providerCall.memberIds.includes(participantId),
    );
    if (activeParticipantIds.length) {
      return res.status(200).json({ success: true, ended: false });
    }

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
