const connectionsByUser = new Map();

export const addNotificationConnection = (userId, response) => {
  const key = userId.toString();
  const connections = connectionsByUser.get(key) || new Set();
  connections.add(response);
  connectionsByUser.set(key, connections);

  return () => {
    connections.delete(response);
    if (connections.size === 0) connectionsByUser.delete(key);
  };
};

export const emitNotificationCreated = (recipientId, notification) => {
  const connections = connectionsByUser.get(recipientId.toString());
  if (!connections) return;

  const payload = `event: notification.created\ndata: ${JSON.stringify({ notification })}\n\n`;
  for (const response of connections) {
    try {
      response.write(payload);
    } catch {
      connections.delete(response);
      response.end();
    }
  }

  if (connections.size === 0) connectionsByUser.delete(recipientId.toString());
};
