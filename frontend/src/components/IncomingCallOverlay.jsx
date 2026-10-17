import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Video } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getStreamToken } from "../lib/api.js";
import useAuthUser from "../hooks/useAuthUser.js";
import { getStreamVideoClient } from "../lib/streamVideoClient.js";
import UserAvatar from "./UserAvatar.jsx";
import { getCallChatId, getIncomingCallType } from "../lib/callSession.js";

const IncomingCallOverlay = () => {
  const { authUser } = useAuthUser();
  const navigate = useNavigate();
  const [incomingCall, setIncomingCall] = useState(null);
  const [isResponding, setIsResponding] = useState(false);
  const responseInFlightRef = useRef(false);
  const { data: tokenData } = useQuery({
    queryKey: ["streamToken"],
    queryFn: getStreamToken,
    enabled: Boolean(authUser),
  });

  useEffect(() => {
    if (!authUser || !tokenData?.token || !import.meta.env.VITE_STREAM_API_KEY)
      return undefined;
    let active = true;
    let client;
    const handleNotification = async (event) => {
      if (!event?.call_cid || event.user?.id === authUser._id || !active)
        return;
      const callId = event.call_cid.split(":").slice(1).join(":");
      if (!callId || incomingCall?.callId === callId) return;
      try {
        const ringingCall = await client.onRingingCall(event.call_cid);
        if (active)
          setIncomingCall({
            call: ringingCall,
            callId,
            callType: getIncomingCallType(event),
            caller: event.user,
            chatId: getCallChatId(ringingCall),
          });
      } catch (error) {
        console.error("Unable to prepare incoming call", error);
      }
    };
    getStreamVideoClient({ user: authUser, token: tokenData.token })
      .then((connectedClient) => {
        if (!active) return;
        client = connectedClient;
        client.on("call.notification", handleNotification);
      })
      .catch((error) =>
        console.error("Unable to connect incoming call listener", error),
      );
    return () => {
      active = false;
      if (client) client.off("call.notification", handleNotification);
    };
  }, [authUser, incomingCall?.callId, tokenData?.token]);

  if (!incomingCall) return null;
  const callerName = incomingCall.caller?.name || "Incoming call";
  const accept = async () => {
    if (responseInFlightRef.current) return;
    responseInFlightRef.current = true;
    setIsResponding(true);
    try {
      const params = new URLSearchParams({
        type: incomingCall.callType,
      });
      if (incomingCall.chatId) params.set("chatId", incomingCall.chatId);
      navigate(`/call/${encodeURIComponent(incomingCall.callId)}?${params}`);
      setIncomingCall(null);
      setIsResponding(false);
      responseInFlightRef.current = false;
    } catch (error) {
      console.error("Unable to accept incoming call", {
        errorType: error?.name || "Error",
        status: error?.status || error?.response?.status || null,
      });
      setIsResponding(false);
      responseInFlightRef.current = false;
    }
  };
  const decline = async () => {
    if (responseInFlightRef.current) return;
    responseInFlightRef.current = true;
    setIsResponding(true);
    try {
      await incomingCall.call.reject("decline");
    } catch (error) {
      console.error("Unable to decline incoming call", {
        errorType: error?.name || "Error",
        status: error?.status || error?.response?.status || null,
      });
    } finally {
      setIncomingCall(null);
      setIsResponding(false);
      responseInFlightRef.current = false;
    }
  };

  return (
    <div className="fixed inset-x-4 top-20 z-[70] mx-auto max-w-sm rounded-2xl border border-base-300 bg-base-100 p-4 shadow-2xl sm:right-6 sm:left-auto">
      <div className="flex items-center gap-3">
        <UserAvatar
          src={incomingCall.caller?.image}
          name={callerName}
          userId={incomingCall.caller?.id}
          alt=""
          className="size-12"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wider opacity-60">
            Incoming {incomingCall.callType} call
          </p>
          <h2 className="truncate font-bold">{callerName}</h2>
        </div>
        {incomingCall.callType === "video" ? (
          <Video className="size-5 text-primary" />
        ) : (
          <Phone className="size-5 text-primary" />
        )}
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className="btn btn-error btn-sm flex-1"
          onClick={decline}
          disabled={isResponding}
        >
          <PhoneOff className="size-4" /> Decline
        </button>
        <button
          type="button"
          className="btn btn-success btn-sm flex-1 text-white"
          onClick={accept}
          disabled={isResponding}
        >
          <Phone className="size-4" /> Accept
        </button>
      </div>
    </div>
  );
};

export default IncomingCallOverlay;
