import { StreamVideoClient } from "@stream-io/video-react-sdk";

let videoClient;

export const getStreamVideoClient = async ({ user, token }) => {
  if (!videoClient) {
    videoClient = new StreamVideoClient({
      apiKey: import.meta.env.VITE_STREAM_API_KEY,
      user: {
        id: user._id,
        name: user.fullName,
        image: user.profilePic,
        type: "authenticated",
      },
      token,
    });
  }
  return videoClient;
};

export const disconnectStreamVideoClient = async () => {
  if (videoClient) {
    await videoClient.disconnectUser();
    videoClient = undefined;
  }
};
