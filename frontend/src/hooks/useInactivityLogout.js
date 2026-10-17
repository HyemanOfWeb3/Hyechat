import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { logout } from "../lib/api.js";
import { disconnectStreamClient } from "./useStreamClient.js";
import { disconnectStreamVideoClient } from "../lib/streamVideoClient.js";

const DEFAULT_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
const WARNING_DURATION_MS = 60 * 1000;
const ACTIVITY_THROTTLE_MS = 1000;
const LOGOUT_CHANNEL_NAME = "hyechat-auth";

const configuredTimeout = Number(import.meta.env.VITE_INACTIVITY_TIMEOUT_MS);
const INACTIVITY_TIMEOUT_MS =
  Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? configuredTimeout
    : DEFAULT_INACTIVITY_TIMEOUT_MS;
const WARNING_TIMEOUT_MS = Math.min(
  WARNING_DURATION_MS,
  INACTIVITY_TIMEOUT_MS / 2,
);

const useInactivityLogout = ({ enabled }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const timeoutRef = useRef(null);
  const warningTimeoutRef = useRef(null);
  const lastActivityRef = useRef(0);
  const isLoggingOutRef = useRef(false);
  const channelRef = useRef(null);

  const clearTimers = useCallback(() => {
    window.clearTimeout(timeoutRef.current);
    window.clearTimeout(warningTimeoutRef.current);
  }, []);

  const clearAuthenticatedState = useCallback(() => {
    clearTimers();
    setShowWarning(false);
    queryClient.cancelQueries();
    queryClient.setQueryData(["authUser"], null);
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] !== "authUser",
    });
  }, [clearTimers, queryClient]);

  const logoutUser = useCallback(
    async ({ broadcast = true } = {}) => {
      if (isLoggingOutRef.current) return;
      isLoggingOutRef.current = true;
      clearAuthenticatedState();

      if (broadcast) channelRef.current?.postMessage({ type: "logout" });
      try {
        await Promise.all([
          disconnectStreamClient(),
          disconnectStreamVideoClient(),
        ]);
      } catch (streamError) {
        console.error("Error disconnecting Stream during logout:", streamError);
        // Continue with logout even if Stream disconnect fails
      }
      try {
        await logout();
      } catch {
        // The local state is cleared even when the server cannot be reached.
      } finally {
        navigate("/login", { replace: true });
        isLoggingOutRef.current = false;
      }
    },
    [clearAuthenticatedState, navigate],
  );

  const resetInactivityTimer = useCallback(() => {
    if (!enabled || isLoggingOutRef.current) return;
    const now = Date.now();
    if (now - lastActivityRef.current < ACTIVITY_THROTTLE_MS) return;
    lastActivityRef.current = now;
    clearTimers();
    setShowWarning(false);
    warningTimeoutRef.current = window.setTimeout(
      () => setShowWarning(true),
      Math.max(0, INACTIVITY_TIMEOUT_MS - WARNING_TIMEOUT_MS),
    );
    timeoutRef.current = window.setTimeout(
      () => logoutUser(),
      INACTIVITY_TIMEOUT_MS,
    );
  }, [clearTimers, enabled, logoutUser]);

  const stayActive = useCallback(() => {
    lastActivityRef.current = 0;
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  useEffect(() => {
    if (!enabled) {
      clearTimers();
      return undefined;
    }

    const activityEvents = [
      "mousemove",
      "keydown",
      "click",
      "touchstart",
      "scroll",
      "pointerdown",
    ];
    activityEvents.forEach((eventName) =>
      window.addEventListener(eventName, resetInactivityTimer, {
        passive: true,
      }),
    );
    resetInactivityTimer();

    return () => {
      activityEvents.forEach((eventName) =>
        window.removeEventListener(eventName, resetInactivityTimer),
      );
      clearTimers();
    };
  }, [clearTimers, enabled, resetInactivityTimer]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return undefined;
    const channel = new BroadcastChannel(LOGOUT_CHANNEL_NAME);
    channelRef.current = channel;
    channel.onmessage = (event) => {
      if (event.data?.type === "logout") logoutUser({ broadcast: false });
    };
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [logoutUser]);

  return {
    showWarning,
    stayActive,
    timeoutMs: INACTIVITY_TIMEOUT_MS,
    warningMs: WARNING_TIMEOUT_MS,
  };
};

export default useInactivityLogout;
