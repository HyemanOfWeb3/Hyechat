import { StreamVideoClient } from "@stream-io/video-react-sdk";
import { createStreamVideoClientManager } from "./streamVideoClientManager.js";

const videoClientManager = createStreamVideoClientManager(
  (options) => new StreamVideoClient(options),
  () => import.meta.env.VITE_STREAM_API_KEY,
);

export const getStreamVideoClient = videoClientManager.get;

export const getCurrentStreamVideoClient = videoClientManager.getCurrent;
export const disconnectStreamVideoClient = videoClientManager.disconnect;
