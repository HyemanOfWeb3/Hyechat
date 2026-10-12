import { StreamVideoClient } from "@stream-io/video-client";

let serverClient;
let configuredApiKey;
let configuredApiSecret;

export const getServerStreamVideoClient = () => {
  const apiKey = process.env.STREAM_API_KEY;
  const apiSecret = process.env.STREAM_API_SECRET;
  if (!apiKey || !apiSecret) {
    throw new Error("Stream Video server authentication is not configured");
  }

  if (
    !serverClient ||
    configuredApiKey !== apiKey ||
    configuredApiSecret !== apiSecret
  ) {
    serverClient = new StreamVideoClient({
      apiKey,
      options: { secret: apiSecret },
    });
    configuredApiKey = apiKey;
    configuredApiSecret = apiSecret;
  }

  return serverClient;
};

export async function getStreamVideoCallSnapshot(callId) {
  const client = getServerStreamVideoClient();
  const call = client.call("default", callId);
  const [{ call: callData, members = [] }, { participants = [] }] =
    await Promise.all([
      call.get({ members_limit: 100 }),
      call.queryParticipants({}, { limit: 100 }),
    ]);

  const creatorId = callData?.created_by?.id;
  const memberIds = new Set(
    members
      .filter((member) => !member.deleted_at)
      .map((member) => member.user_id || member.user?.id)
      .filter(Boolean),
  );
  if (creatorId) memberIds.add(creatorId);

  return {
    creatorId,
    memberIds: [...memberIds],
    activeParticipantIds: [
      ...new Set(
        participants.map((participant) => participant.user?.id).filter(Boolean),
      ),
    ],
  };
}
