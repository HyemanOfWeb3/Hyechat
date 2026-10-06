import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import {
  getDisabledNotificationTypes,
  normalizeNotificationPreferences,
} from "../services/notification.service.js";

const getUserNotificationFilter = async (userId) => {
  const user = await User.findById(userId).select("notificationPreferences");
  const disabledTypes = getDisabledNotificationTypes(
    user?.notificationPreferences || {},
  );
  return disabledTypes.length ? { type: { $nin: disabledTypes } } : {};
};

const ACTOR_PROJECTION =
  "fullName profilePic nativeLanguage learningLanguage location";

// GET /api/notifications
export async function getNotifications(req, res) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  try {
    const filteredQuery = await getUserNotificationFilter(req.user._id);
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ recipient: req.user._id, ...filteredQuery })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("actor", ACTOR_PROJECTION),
      Notification.countDocuments({
        recipient: req.user._id,
        ...filteredQuery,
      }),
      Notification.countDocuments({
        recipient: req.user._id,
        read: false,
        ...filteredQuery,
      }),
    ]);

    return res.status(200).json({
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        hasMore: skip + notifications.length < total,
      },
    });
  } catch (error) {
    console.error("Error getting notifications", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

// PATCH /api/notifications/:id/read
export async function markAsRead(req, res) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid notification ID" });
  }

  try {
    const notification = await Notification.findById(id);

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    if (notification.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "You are not authorized to update this notification",
      });
    }

    notification.read = true;
    await notification.save();

    return res.status(200).json({ success: true, notification });
  } catch (error) {
    console.error("Error marking notification as read", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

// PATCH /api/notifications/read-all
export async function markAllAsRead(req, res) {
  try {
    const result = await Notification.updateMany(
      { recipient: req.user._id, read: false },
      { read: true },
    );

    return res.status(200).json({
      success: true,
      updated: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error marking all notifications as read", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

// DELETE /api/notifications/:id
export async function deleteNotification(req, res) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid notification ID" });
  }

  try {
    const notification = await Notification.findById(id);

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    if (notification.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "You are not authorized to delete this notification",
      });
    }

    await Notification.deleteOne({ _id: notification._id });

    return res
      .status(200)
      .json({ success: true, message: "Notification deleted" });
  } catch (error) {
    console.error("Error deleting notification", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
