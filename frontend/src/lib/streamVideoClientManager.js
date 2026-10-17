export const createStreamVideoClientManager = (createClient, getApiKey) => {
  let client;
  let userId;
  let apiKey;
  let operation = Promise.resolve();

  const enqueue = (work) => {
    const next = operation.then(work);
    operation = next.catch(() => undefined);
    return next;
  };

  return {
    get: ({ user, token }) => {
      const nextUserId = String(user?._id || user?.id || "");
      if (!nextUserId) {
        return Promise.reject(
          new Error("A signed-in user is required for calls."),
        );
      }
      if (!token) {
        return Promise.reject(
          new Error("A valid Stream Video token is required."),
        );
      }

      return enqueue(async () => {
        const nextApiKey = getApiKey();
        if (!nextApiKey) {
          throw new Error("Stream Video is not configured.");
        }
        if (client && userId === nextUserId && apiKey === nextApiKey) {
          return client;
        }

        const previousClient = client;
        client = undefined;
        userId = undefined;
        apiKey = undefined;
        if (previousClient) await previousClient.disconnectUser();

        const nextClient = createClient({
          apiKey: nextApiKey,
          user: {
            id: nextUserId,
            name: user.fullName || user.name || nextUserId,
            image: user.profilePic || user.image || "",
            type: "authenticated",
          },
          token,
        });
        client = nextClient;
        userId = nextUserId;
        apiKey = nextApiKey;
        return nextClient;
      });
    },
    disconnect: () =>
      enqueue(async () => {
        const previousClient = client;
        client = undefined;
        userId = undefined;
        apiKey = undefined;
        if (previousClient) await previousClient.disconnectUser();
      }),
    getCurrent: () => client,
  };
};
