import * as Ably from "ably";

let ablyRest;

const getAblyRest = () => {
  if (!process.env.ABLY_API_KEY) {
    throw new Error("ABLY_API_KEY is missing");
  }

  if (!ablyRest) ablyRest = new Ably.Rest(process.env.ABLY_API_KEY);
  return ablyRest;
};

export const getNotificationChannelName = (userId) =>
  `notifications:user:${userId.toString()}`;

export const createNotificationTokenRequest = async (userId) => {
  const channelName = getNotificationChannelName(userId);
  return getAblyRest().auth.createTokenRequest({
    clientId: `user:${userId.toString()}`,
    capability: JSON.stringify({ [channelName]: ["subscribe"] }),
  });
};

export const publishNotification = async (recipientId, notification) => {
  const channel = getAblyRest().channels.get(
    getNotificationChannelName(recipientId),
  );
  await channel.publish("notification.created", notification);
};
