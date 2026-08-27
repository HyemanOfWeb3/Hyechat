import { StreamChat } from "stream-chat";
import "dotenv/config";

const apiKey = process.env.STREAM_API_KEY;
const apiSecret = process.env.STREAM_API_SECRET;

if (!apiKey || !apiSecret) {
  console.error("Stream API key or Secret is missing");
}

const streamClient = StreamChat.getInstance(apiKey, apiSecret);

export const verifyStreamWebhook = (rawBody, signature) =>
  streamClient.verifyWebhook(rawBody, signature);

export const areStreamChannelMembers = async ({
  channelType,
  channelId,
  userIds,
}) => {
  const channel = streamClient.channel(channelType, channelId);
  const { members } = await channel.queryMembers({}, [], { limit: 100 });
  const memberIds = new Set(
    members.map((member) => member.user_id || member.user?.id),
  );

  return userIds.every((userId) => memberIds.has(userId));
};

export const upsertStreamUser = async (userData) => {
  try {
    await streamClient.upsertUsers([userData]);
    return userData;
  } catch (error) {
    console.error("Error upserting Stream user:", error);
    throw error;
  }
};

export const generateStreamToken = (userId) => {
  try {
    //ensure userId is a string
    const userIdStr = userId.toString();
    return streamClient.createToken(userIdStr);
  } catch (error) {
    console.error("Error generating Stream token:", error);
  }
};

export const deleteStreamImage = async (imageUrl) => {
  return streamClient.deleteImage(imageUrl);
};

export const createCommunityChannel = async ({
  channelId,
  ownerId,
  memberIds,
  name,
  image,
  communityId,
}) => {
  const channel = streamClient.channel("messaging", channelId, {
    name,
    image: image || "",
    community: true,
    community_id: communityId.toString(),
    created_by_id: ownerId.toString(),
  });

  await channel.create();
  const uniqueMemberIds = [...new Set(memberIds.map((id) => id.toString()))];
  if (uniqueMemberIds.length > 1) {
    await channel.addMembers(
      uniqueMemberIds.filter((id) => id !== ownerId.toString()),
    );
  }

  return channel;
};

export const updateCommunityChannel = async ({
  channelId,
  name,
  image,
  communityId,
}) => {
  const channel = streamClient.channel("messaging", channelId);
  await channel.update({
    name,
    image: image || "",
    community: true,
    community_id: communityId.toString(),
  });
  return channel;
};

export const addCommunityChannelMember = async ({ channelId, userId }) => {
  const channel = streamClient.channel("messaging", channelId);
  await channel.addMembers([userId.toString()]);
};

export const removeCommunityChannelMember = async ({ channelId, userId }) => {
  const channel = streamClient.channel("messaging", channelId);
  await channel.removeMembers([userId.toString()]);
};

export const deleteCommunityChannel = async (channelId) => {
  const channel = streamClient.channel("messaging", channelId);
  await channel.delete();
};
