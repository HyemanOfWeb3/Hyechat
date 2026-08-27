import Notification from "../models/Notification.js";
import { emitNotificationCreated } from "../lib/notificationStream.js";

const notificationActorProjection =
  "_id fullName profilePic nativeLanguage learningLanguage";

const emitPersistedNotification = async (notification) => {
  try {
    const populatedNotification = await Notification.findById(notification._id)
      .populate("actor", notificationActorProjection)
      .lean();

    if (populatedNotification) {
      emitNotificationCreated(populatedNotification.recipient, {
        _id: populatedNotification._id,
        actor: populatedNotification.actor,
        type: populatedNotification.type,
        story: populatedNotification.story,
        reactionType: populatedNotification.reactionType,
        messageId: populatedNotification.messageId,
        read: populatedNotification.read,
        createdAt: populatedNotification.createdAt,
      });
    }
  } catch (error) {
    console.error("Error emitting notification event", error.message);
  }

  return notification;
};

/**
 * Creates a notification, or for story_reaction updates an existing unread
 * notification for the same actor + recipient + story to avoid spam.
 *
 * @param {Object} params
 * @param {string|ObjectId} params.recipient
 * @param {string|ObjectId} params.actor
 * @param {"story_reaction"|"story_reply"|"friend_request"|"friend_accepted"|"friend_declined"|"friend_cancelled"|"friend_removed"} params.type
 * @param {string|ObjectId} [params.story]
 * @param {string} [params.reactionType]
 * @param {string} [params.messageId]
 */
export async function createNotification({
  recipient,
  actor,
  type,
  story,
  reactionType = null,
  messageId = null,
}) {
  if (type === "story_reply" && messageId) {
    const notification = await Notification.findOneAndUpdate(
      { type: "story_reply", messageId },
      {
        $setOnInsert: {
          recipient,
          actor,
          story,
          reactionType: null,
          messageId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    return emitPersistedNotification(notification);
  }

  if (type === "story_reaction") {
    // If an unread reaction notification already exists for this
    // actor + recipient + story, update its reactionType instead of
    // creating a duplicate.
    const existing = await Notification.findOneAndUpdate(
      {
        recipient,
        actor,
        type: "story_reaction",
        story,
        read: false,
      },
      { reactionType },
      { new: true },
    );

    if (existing) return emitPersistedNotification(existing);
  }

  const notification = await Notification.create({
    recipient,
    actor,
    type,
    story,
    reactionType,
    messageId,
  });

  return emitPersistedNotification(notification);
}
