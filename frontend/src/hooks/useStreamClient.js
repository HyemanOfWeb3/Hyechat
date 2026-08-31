import { useEffect, useState, useCallback } from "react";
import { StreamChat } from "stream-chat";
import { getStreamToken } from "../lib/api.js";
import useAuthUser from "./useAuthUser.js";

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

// Singleton instance to persist across component remounts
let sharedClientInstance = null;
let connectPromise = null;

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
    // If already connected with this user, return
    if (sharedClientInstance?.userID === authUser?._id) {
      setClient(sharedClientInstance);
      setConnectionState("connected");
      return sharedClientInstance;
    }

    // If connection is in progress, wait for it
    if (connectPromise) {
      return connectPromise;
    }

    if (!authUser || !STREAM_API_KEY) {
      setConnectionState("disconnected");
      return null;
    }

    setIsConnecting(true);
    setConnectionState("connecting");
    setError("");

    // Create promise to track connection
    connectPromise = (async () => {
      try {
        const tokenData = await getStreamToken();
        if (!tokenData?.token) {
          throw new Error("Unable to obtain Stream token");
        }

        // Get or create client instance
        if (!sharedClientInstance) {
          sharedClientInstance = StreamChat.getInstance(STREAM_API_KEY);
        }

        const clientInstance = sharedClientInstance;

        // Only connect if not already connected to this user
        if (clientInstance.userID !== authUser._id) {
          await clientInstance.connectUser(
            {
              id: authUser._id,
              name: authUser.fullName,
              image: authUser.profilePic,
            },
            tokenData.token,
          );

          // Set up reconnection listener
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
        }

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
      // Only reconnect if we were connected before
      if (
        connectionState === "disconnected" &&
        sharedClientInstance?.userID === authUser?._id
      ) {
        setConnectionState("connecting");
        try {
          const tokenData = await getStreamToken();
          if (tokenData?.token && sharedClientInstance) {
            // Stream SDK should handle reconnection automatically
            setConnectionState("connected");
          }
        } catch (err) {
          console.error("Reconnection failed:", err);
          setError("Reconnection failed. Try refreshing the page.");
        }
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
  }, [authUser?._id, connectionState]);

  // Handle app visibility changes (mobile tab restore)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.hidden) {
        // App went to background - don't disconnect, just track state
        console.log("App backgrounded");
      } else {
        // App came to foreground - verify connection
        console.log("App foregrounded - verifying Stream connection");
        if (
          connectionState === "disconnected" &&
          sharedClientInstance?.userID === authUser?._id
        ) {
          try {
            setConnectionState("connecting");
            const tokenData = await getStreamToken();
            if (tokenData?.token && sharedClientInstance) {
              setConnectionState("connected");
            }
          } catch (err) {
            console.error("Reconnection on foreground failed:", err);
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [connectionState, authUser?._id]);

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
