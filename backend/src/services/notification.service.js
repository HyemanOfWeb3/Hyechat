import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { publishNotification } from "../lib/ably.js";

const notificationActorProjection =
  "_id fullName profilePic nativeLanguage learningLanguage";

export const DEFAULT_NOTIFICATION_PREFERENCES = {
  messages: { inApp: true, email: false },
  friendRequests: { inApp: true, email: false },
  storyReactions: { inApp: true, email: false },
  storyReplies: { inApp: true, email: false },
  communityActivity: { inApp: true, email: false },
  calls: { inApp: true, email: false },
  marketplace: { inApp: true, email: false },
  mentions: { inApp: true, email: false },
  languagePartnerActivity: { inApp: true, email: false },
};

export const normalizeNotificationPreferences = (preferences = {}) => {
  return Object.fromEntries(
    Object.entries(DEFAULT_NOTIFICATION_PREFERENCES).map(
      ([categoryKey, defaults]) => {
        const current = preferences?.[categoryKey] || {};
        return [
          categoryKey,
          {
            inApp:
              current.inApp !== undefined
                ? Boolean(current.inApp)
                : defaults.inApp,
            email:
              current.email !== undefined
                ? Boolean(current.email)
                : defaults.email,
          },
        ];
      },
    ),
  );
};

const NOTIFICATION_TYPES_BY_CATEGORY = {
  messages: ["message"],
  friendRequests: [
    "friend_request",
    "friend_accepted",
    "friend_declined",
    "friend_cancelled",
    "friend_removed",
  ],
  storyReactions: ["story_reaction"],
  storyReplies: ["story_reply"],
  communityActivity: ["community_activity"],
  calls: ["call"],
  marketplace: ["marketplace"],
  mentions: ["mention"],
  languagePartnerActivity: ["language_partner_activity"],
};

const categoryForNotificationType = (type) => {
  return Object.entries(NOTIFICATION_TYPES_BY_CATEGORY).find(([, types]) =>
    types.includes(type),
  )?.[0] || null;
};

export const getDisabledNotificationTypes = (preferences = {}) => {
  const normalized = normalizeNotificationPreferences(preferences);
  return Object.entries(NOTIFICATION_TYPES_BY_CATEGORY).flatMap(
    ([category, types]) => normalized[category].inApp ? [] : types,
  );
};

export const isNotificationEnabledForUser = async ({ recipient, type }) => {
  const category = categoryForNotificationType(type);
  if (!category) return true;

  const user = await User.findById(recipient).select("notificationPreferences");
  const preferences = normalizeNotificationPreferences(
    user?.notificationPreferences || {},
  );
  return !!preferences[category]?.inApp;
};

const emitPersistedNotification = async (notification) => {
  try {
    const populatedNotification = await Notification.findById(notification._id)
      .populate("actor", notificationActorProjection)
      .lean();

    if (populatedNotification) {
      await publishNotification(populatedNotification.recipient, {
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
    console.error("Error publishing notification event", error.message);
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
  const inAppEnabled = await isNotificationEnabledForUser({ recipient, type });
  if (!inAppEnabled) {
    return null;
  }

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
