const NON_ACTIONABLE_MESSAGE_TYPES = new Set([
  "system",
  "deleted",
  "error",
  "ephemeral",
]);

const CONTACT_ACTION_TYPES = new Set(["viewProfile", "voiceCall", "videoCall"]);

export const getMessageMenuCapabilities = (
  message,
  currentUserId,
  { isCallMessage = false } = {},
) => {
  const authorId = message?.user?.id;
  const isActionable = Boolean(
    authorId &&
      !NON_ACTIONABLE_MESSAGE_TYPES.has(message.type) &&
      !message.deleted_at,
  );
  const hasCurrentUser =
    currentUserId !== undefined &&
    currentUserId !== null &&
    String(currentUserId).trim() !== "";
  const isPeerMessage =
    isActionable &&
    hasCurrentUser &&
    String(authorId) !== String(currentUserId);
  const hasContent = Boolean(
    message?.text?.trim() || message?.attachments?.length,
  );

  return {
    canContactAuthor: isPeerMessage,
    canForward: isActionable && hasContent && !isCallMessage,
  };
};

export const buildContextualMessageActionSet = ({
  defaultActionSet = [],
  allowedActions = [],
  customActions = [],
  canContactAuthor = false,
  canForward = false,
}) => {
  const allowed = new Set(allowedActions);
  const streamActions = defaultActionSet.filter((action) => {
    if (action.placement === "quick-dropdown-toggle") return true;
    if (action.placement !== "dropdown") return false;

    // Copy is part of Stream's default menu but is not a configurable action.
    return action.type === "copyMessageText" || allowed.has(action.type);
  });
  const applicableCustomActions = customActions.filter(({ type }) => {
    if (type === "forward") return canForward;
    return CONTACT_ACTION_TYPES.has(type) && canContactAuthor;
  });

  return [...streamActions, ...applicableCustomActions];
};
