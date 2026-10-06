import { useEffect, useState, useCallback } from "react";
import { StreamChat } from "stream-chat";
import { getStreamToken } from "../lib/api.js";
import useAuthUser from "./useAuthUser.js";

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

// Singleton instance to persist across component remounts
let sharedClientInstance = null;
let connectPromise = null;

const attachStreamConnectionHandlers = (clientInstance) => {
  if (!clientInstance || clientInstance.__hyechatHandlersBound) return;

  clientInstance.on("connection.recovered", () => {
    console.info("Stream connection recovered");
  });

  clientInstance.on("connection.changed", (event) => {
    console.info("Stream connection changed:", event?.online ? "online" : "offline");
  });

  clientInstance.__hyechatHandlersBound = true;
};

/**
 * Hook that provides a persistent, shared Stream Chat client.
 * Prevents multiple connectUser calls and premature disconnects.
 *
 * Features:
 * - Single client instance across entire app
 * - Automatic reconnection on network changes
 * - Connection state tracking
 * - Graceful error handling
 *
 * Returns: { client, isConnecting, error, connectionState }
 */
export const useStreamClient = () => {
  const { authUser } = useAuthUser();
  const [client, setClient] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");
  const [connectionState, setConnectionState] = useState("disconnected"); // disconnected, connecting, connected

  const connect = useCallback(async () => {
    if (!authUser || !STREAM_API_KEY) {
      setConnectionState("disconnected");
      return null;
    }

    if (sharedClientInstance?.userID === authUser._id) {
      attachStreamConnectionHandlers(sharedClientInstance);
      setClient(sharedClientInstance);
      setConnectionState("connected");
      return sharedClientInstance;
    }

    if (connectPromise) {
      return connectPromise;
    }

    setIsConnecting(true);
    setConnectionState("connecting");
    setError("");

    connectPromise = (async () => {
      try {
        const tokenData = await getStreamToken();
        if (!tokenData?.token) {
          throw new Error("Unable to obtain Stream token");
        }

        if (!sharedClientInstance) {
          sharedClientInstance = StreamChat.getInstance(STREAM_API_KEY);
        }

        const clientInstance = sharedClientInstance;
        attachStreamConnectionHandlers(clientInstance);

        if (clientInstance.userID !== authUser._id) {
          await clientInstance.connectUser(
            {
              id: authUser._id,
              name: authUser.fullName,
              image: authUser.profilePic,
            },
            tokenData.token,
          );
        }

        clientInstance.on("connection.recovered", () => {
          setConnectionState("connected");
        });

        clientInstance.on("connection.changed", (event) => {
          if (event.online) {
            setConnectionState("connected");
          } else {
            setConnectionState("disconnected");
          }
        });

        setClient(clientInstance);
        setConnectionState("connected");
        return clientInstance;
      } catch (connectionError) {
        console.error("Failed to connect Stream client:", connectionError);
        setError(connectionError.message || "Failed to connect to chat");
        setConnectionState("disconnected");
        throw connectionError;
      } finally {
        setIsConnecting(false);
        connectPromise = null;
      }
    })();

    return connectPromise;
  }, [authUser]);

  const reconnectClient = useCallback(async () => {
    if (!authUser || !STREAM_API_KEY) return null;

    try {
      setConnectionState("connecting");
      setError("");

      if (!sharedClientInstance) {
        sharedClientInstance = StreamChat.getInstance(STREAM_API_KEY);
      }

      const tokenData = await getStreamToken();
      if (!tokenData?.token) {
        throw new Error("Unable to obtain Stream token");
      }

      if (sharedClientInstance.userID !== authUser._id) {
        await sharedClientInstance.connectUser(
          {
            id: authUser._id,
            name: authUser.fullName,
            image: authUser.profilePic,
          },
          tokenData.token,
        );
      } else {
        await sharedClientInstance.connectUser(
          {
            id: authUser._id,
            name: authUser.fullName,
            image: authUser.profilePic,
          },
          tokenData.token,
        );
      }

      setClient(sharedClientInstance);
      setConnectionState("connected");
      return sharedClientInstance;
    } catch (connectionError) {
      console.error("Failed to reconnect Stream client:", connectionError);
      setError(connectionError.message || "Reconnection failed");
      setConnectionState("disconnected");
      return null;
    }
  }, [authUser]);

  // Initial connection
  useEffect(() => {
    let active = true;

    const connectAsync = async () => {
      try {
        await connect();
        if (!active) {
          // Component was unmounted, don't set state
          return;
        }
      } catch {
        if (active) {
          // Connection failed, will retry on next effect
        }
      }
    };

    connectAsync();

    return () => {
      active = false;
    };
  }, [connect, authUser?._id]);

  // Handle network status changes
  useEffect(() => {
    const handleOnline = async () => {
      console.log("Network online - reconnecting Stream client");
      if (authUser && sharedClientInstance?.userID === authUser._id) {
        await reconnectClient();
      }
    };

    const handleOffline = () => {
      console.log("Network offline");
      setConnectionState("disconnected");
      setError("Network connection lost");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [authUser, reconnectClient]);

  // Handle app visibility changes (mobile tab restore)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.hidden) {
        console.log("App backgrounded");
      } else {
        console.log("App foregrounded - verifying Stream connection");
        if (authUser && sharedClientInstance?.userID === authUser._id) {
          await reconnectClient();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [authUser, reconnectClient]);

  // Cleanup on unmount - DON'T DISCONNECT, just clear component reference
  useEffect(() => {
    return () => {
      // Never disconnect the shared client on component unmount
      // This prevents the "Both secret and user tokens are not set" error
    };
  }, []);

  return {
    client,
    isConnecting,
    error,
    connectionState,
  };
};

/**
 * Get the current shared client instance if it exists.
 * Used for components that need the client without the full hook lifecycle.
 */
export const getSharedStreamClient = () => {
  return sharedClientInstance;
};

/**
 * Disconnect the shared Stream Chat client.
 * Called during logout to cleanly disconnect before auth state is cleared.
 */
export const disconnectStreamClient = async () => {
  if (sharedClientInstance && sharedClientInstance.userID) {
    try {
      console.log("Disconnecting Stream Chat client");
      await sharedClientInstance.disconnectUser();
      sharedClientInstance = null;
      connectPromise = null;
    } catch (error) {
      console.error("Error disconnecting Stream client:", error);
      // Still null out the instance even if disconnect fails
      sharedClientInstance = null;
      connectPromise = null;
    }
  }
};

export default useStreamClient;
