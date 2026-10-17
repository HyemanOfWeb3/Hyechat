import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  PhoneOff,
  ScreenShare,
  Users,
  Video,
  Mic,
  Sparkles,
  ShieldCheck,
  Zap,
  Download,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  CancelCallButton,
  ReactionsButton,
  SpeakerLayout,
  StreamCall,
  StreamTheme,
  StreamVideo,
  CallRecordingList,
  CallingState,
  ToggleAudioPublishingButton,
  ToggleVideoPublishingButton,
  useCallStateHooks,
} from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";

import { getStreamToken } from "../lib/api.js";
import { endCallHistory, startCallHistory } from "../lib/api.js";
import useAuthUser from "../hooks/useAuthUser.js";
import { getStreamVideoClient } from "../lib/streamVideoClient.js";
import {
  getCallConnectionLabel,
  getCallChatId,
  getCallJoinErrorMessage,
  activateCallMedia,
  joinStreamCall,
  leaveStreamCall,
} from "../lib/callSession.js";

const CallStateObserver = ({ onCallingStateChange }) => {
  const { useCallCallingState } = useCallStateHooks();
  const callingState = useCallCallingState();

  useEffect(() => {
    onCallingStateChange(callingState);
  }, [callingState, onCallingStateChange]);

  return null;
};

const CallMediaControls = ({ isVoice, onLeave, onMediaError }) => (
  <div className="str-video__call-controls">
    <ToggleAudioPublishingButton onError={onMediaError} />
    {!isVoice && <ToggleVideoPublishingButton onError={onMediaError} />}
    <ReactionsButton />
    <CancelCallButton onLeave={onLeave} />
  </div>
);

const meetingHighlights = [
  { label: "Audio", value: "Use the mic control to enable" },
  { label: "Video", value: "Use the camera control to enable" },
  { label: "Connection", value: "Secured by Stream" },
];

const CallPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const callType = searchParams.get("type") || "video";
  const requestedChatId = searchParams.get("chatId") || "";
  const isVoice = callType === "voice";

  const { authUser, isLoading: authLoading } = useAuthUser();
  const historyStartedRef = useRef(false);
  const historyEndedRef = useRef(false);
  const historyStartPromiseRef = useRef(null);
  const leaveInProgressRef = useRef(false);
  const activeCallRef = useRef(null);
  const [chatId, setChatId] = useState(requestedChatId);
  const [isJoining, setIsJoining] = useState(true);
  const [callingState, setCallingState] = useState(CallingState.UNKNOWN);
  const [mediaError, setMediaError] = useState("");
  const [joinAttempt, setJoinAttempt] = useState(0);
  const {
    data: tokenData,
    isLoading: tokenLoading,
    refetch: refetchToken,
  } = useQuery({
    queryKey: ["streamToken", authUser?._id],
    queryFn: getStreamToken,
    enabled: !!authUser,
  });

  const [videoClient, setVideoClient] = useState(null);
  const [call, setCall] = useState(null);
  const [joinError, setJoinError] = useState("");
  const [recordings, setRecordings] = useState([]);
  const [recordingLoading, setRecordingLoading] = useState(false);
  const [savingRecordingId, setSavingRecordingId] = useState(null);
  const [cameraDevices, setCameraDevices] = useState([]);
  const [selectedCameraDeviceId, setSelectedCameraDeviceId] = useState(null);
  const [switchingCamera, setSwitchingCamera] = useState(false);
  const [cameraSelectionError, setCameraSelectionError] = useState("");
  const [supportsScreenShare] = useState(() => {
    // Detect screen sharing capability once on mount
    return Boolean(
      navigator.mediaDevices?.getDisplayMedia ||
      navigator.getDisplayMedia ||
      navigator.webkitGetDisplayMedia,
    );
  });
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const recordingDestination = import.meta.env.VITE_RECORDING_DESTINATION;
  const unavailableError =
    !authLoading && !authUser
      ? "Sign in to join this call."
      : !id
        ? "This call link is incomplete. Return to chat and start a new call."
        : !tokenLoading && authUser && !tokenData?.token
          ? "Unable to get secure calling access. Return to chat and try again."
          : "";
  const visibleJoinError = joinError || unavailableError;

  const refreshRecordings = async () => {
    if (!call?.listRecordings) return;
    try {
      const res = await call.listRecordings();
      setRecordings(res?.recordings || []);
    } catch (e) {
      console.error("refreshRecordings failed", e);
    }
  };

  const getRecordingUrl = (recording) => {
    return (
      recording?.url ||
      recording?.recording_url ||
      recording?.file_url ||
      recording?.download_url ||
      recording?.asset_url ||
      recording?.src ||
      null
    );
  };

  const getRecordingName = (recording) => {
    const dateStamp = new Date().toISOString().slice(0, 10);
    const baseName = `hyechat-${dateStamp}`;

    if (recording?.filename || recording?.name || recording?.title) {
      return `${baseName}.mp4`;
    }

    return `${baseName}.mp4`;
  };

  const saveRecordingToDevice = async (recording, index) => {
    const recordingUrl = getRecordingUrl(recording);

    if (!recordingUrl) {
      toast.error("The recording is not ready to download yet.");
      return;
    }

    try {
      setSavingRecordingId(recording?.id || index);
      const response = await fetch(recordingUrl);

      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = getRecordingName(recording);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
      toast.success("Recording saved to your device");
    } catch (error) {
      console.error("saveRecordingToDevice failed", error);
      try {
        const link = document.createElement("a");
        link.href = recordingUrl;
        link.download = getRecordingName(recording);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Recording download started");
      } catch (fallbackError) {
        console.error("fallback download failed", fallbackError);
        toast.error("Unable to save the recording right now.");
      }
    } finally {
      setSavingRecordingId(null);
    }
  };

  const goToChat = useCallback(() => {
    if (chatId) {
      navigate(`/chat/${encodeURIComponent(chatId)}?refresh=${Date.now()}`, {
        replace: true,
      });
    } else {
      navigate("/calls", { replace: true });
    }
  }, [chatId, navigate]);

  const finalizeCallHistory = useCallback(() => {
    if (historyEndedRef.current) return;
    const pendingStart = historyStartPromiseRef.current;
    void Promise.resolve(pendingStart).then(async () => {
      if (!historyStartedRef.current || historyEndedRef.current) return;
      historyEndedRef.current = true;
      try {
        await endCallHistory(id);
      } catch (error) {
        console.error("Could not finalize call history", error);
      }
    });
  }, [id]);

  const ensureCallHistory = useCallback(() => {
    if (historyStartedRef.current) return Promise.resolve(true);
    if (historyStartPromiseRef.current) return historyStartPromiseRef.current;

    historyStartPromiseRef.current = startCallHistory({
      roomId: id,
      callType: isVoice ? "voice" : "video",
    })
      .then(() => {
        historyStartedRef.current = true;
        return true;
      })
      .catch((error) => {
        console.error("Could not save call history", error);
        return false;
      });
    return historyStartPromiseRef.current;
  }, [id, isVoice]);

  const finishCallUi = useCallback(() => {
    setVideoClient(null);
    setCall(null);
    goToChat();
  }, [goToChat]);

  const handleCallingStateChange = useCallback(
    (nextState) => {
      setCallingState(nextState);
      if (nextState !== CallingState.LEFT) return;
      finalizeCallHistory();
      if (!leaveInProgressRef.current) {
        leaveInProgressRef.current = true;
        finishCallUi();
      }
    },
    [finalizeCallHistory, finishCallUi],
  );

  const handleLeaveCall = async () => {
    if (leaveInProgressRef.current) return;
    leaveInProgressRef.current = true;
    try {
      await leaveStreamCall(call);
    } catch (error) {
      console.error("Error leaving call", error);
    } finally {
      finalizeCallHistory();
      finishCallUi();
    }
  };

  const handleSwitchCamera = async (deviceId) => {
    if (!call || switchingCamera || !deviceId) return;

    try {
      setSwitchingCamera(true);
      setCameraSelectionError("");
      await call.camera.select(deviceId);
      setSelectedCameraDeviceId(deviceId);
      toast.success("Camera switched");
    } catch (error) {
      console.error("Failed to switch camera", error);
      setCameraSelectionError("Unable to switch camera right now.");
      toast.error("Unable to switch camera right now.");
    } finally {
      setSwitchingCamera(false);
    }
  };

  const handleMediaError = useCallback(
    (error) => {
      const message = getCallJoinErrorMessage(
        error,
        isVoice ? "voice" : "video",
      );
      setMediaError(message);
      toast.error(message);
    },
    [isVoice],
  );

  const handleScreenShare = async () => {
    if (!call || !supportsScreenShare) return;

    try {
      if (isScreenSharing) {
        await call.screenShare.disable();
        setIsScreenSharing(false);
        toast.success("Screen sharing stopped");
      } else {
        await call.screenShare.enable();
        setIsScreenSharing(true);
        toast.success("Screen sharing started");
      }
    } catch (error) {
      console.error("Screen sharing error:", error);
      const errorMessage = error?.message || "";
      if (errorMessage.includes("NotAllowedError")) {
        toast.error("Screen sharing permission denied");
      } else {
        toast.error("Unable to share screen right now");
      }
      setIsScreenSharing(false);
    }
  };

  const loadCameraDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(
        (device) => device.kind === "videoinput" && device.deviceId,
      );
      setCameraDevices(videoInputs);
      setSelectedCameraDeviceId((current) =>
        videoInputs.some((device) => device.deviceId === current)
          ? current
          : videoInputs[0]?.deviceId || null,
      );
    } catch (error) {
      console.error("Failed to load camera devices", error);
    }
  }, []);

  const retryJoining = async () => {
    setJoinError("");
    setMediaError("");
    setIsJoining(true);
    await refetchToken();
    setJoinAttempt((attempt) => attempt + 1);
  };

  useEffect(() => {
    const devices = navigator.mediaDevices;
    devices?.addEventListener?.("devicechange", loadCameraDevices);
    return () =>
      devices?.removeEventListener?.("devicechange", loadCameraDevices);
  }, [loadCameraDevices]);

  useEffect(() => {
    if (authLoading || tokenLoading) return undefined;
    let isActive = true;
    let videoCall;

    if (!authUser || !id) {
      return () => {
        isActive = false;
      };
    }
    if (!tokenData?.token) {
      return () => {
        isActive = false;
      };
    }

    const joinCall = async () => {
      try {
        const client = await getStreamVideoClient({
          user: authUser,
          token: tokenData.token,
        });
        videoCall = client.call("default", id);
        await joinStreamCall(videoCall);
        const storedChatId = getCallChatId(videoCall);
        if (!requestedChatId && typeof storedChatId === "string") {
          setChatId(storedChatId);
        }
        if (!isActive) {
          await leaveStreamCall(videoCall).catch(() => {});
          return;
        }
        const mediaErrors = await activateCallMedia(
          videoCall,
          isVoice ? "voice" : "video",
        );
        if (mediaErrors.length) {
          setMediaError(mediaErrors.join(" "));
          toast.error(mediaErrors[0]);
        }
        activeCallRef.current = videoCall;
        setCallingState(videoCall.state.callingState);
        setVideoClient(client);
        setCall(videoCall);
        setIsJoining(false);
        void loadCameraDevices();
        void ensureCallHistory();
      } catch (error) {
        console.error("Unable to join Stream call:", error);
        if (isActive) {
          setJoinError(
            getCallJoinErrorMessage(error, isVoice ? "voice" : "video"),
          );
          setIsJoining(false);
        }
      }
    };

    joinCall();

    return () => {
      isActive = false;
      const activeCall = activeCallRef.current;
      activeCallRef.current = null;
      void (async () => {
        if (activeCall && activeCall.state.callingState !== CallingState.LEFT) {
          await leaveStreamCall(activeCall).catch(() => {});
        }
        finalizeCallHistory();
      })();
    };
  }, [
    authLoading,
    authUser,
    ensureCallHistory,
    finalizeCallHistory,
    id,
    isVoice,
    joinAttempt,
    loadCameraDevices,
    requestedChatId,
    tokenData?.token,
    tokenLoading,
  ]);

  if (authLoading || tokenLoading || (isJoining && !visibleJoinError)) {
    return (
      <div
        className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-base-200 p-4 text-center"
        role="status"
        aria-live="polite"
      >
        <span className="loading loading-spinner loading-lg text-primary" />
        <p className="font-medium">
          {authLoading || tokenLoading
            ? "Connecting securely to Stream…"
            : `Joining ${isVoice ? "voice" : "video"} call…`}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] overflow-y-auto bg-base-200 p-3 pb-[calc(1rem+env(safe-area-inset-bottom))] lg:p-4">
      <div className="mx-auto flex max-w-7xl flex-col gap-3">
        <div className="rounded-3xl border border-base-300 bg-gradient-to-br from-base-100 via-base-100 to-primary/10 p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                {!isVoice ? (
                  <>
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h2 className="text-xl font-semibold">Video meeting</h2>
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4 text-primary" />
                    <h2 className="text-xl font-semibold">Voice call</h2>
                  </>
                )}
              </div>
              <p className="mt-1 break-all text-sm opacity-70">
                Room: {id || "unknown"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div
                className={`badge gap-2 ${callingState === CallingState.JOINED ? "badge-success" : "badge-warning"}`}
              >
                <Users className="h-3.5 w-3.5" />
                {getCallConnectionLabel(callingState, isJoining)}
              </div>
              <button
                type="button"
                className="btn btn-error btn-sm gap-2"
                onClick={handleLeaveCall}
              >
                <PhoneOff className="h-4 w-4" />
                Leave call
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {meetingHighlights.map((item) => (
              <div
                key={item.label}
                className="badge badge-ghost gap-2 px-3 py-3"
              >
                <Zap className="h-3.5 w-3.5 text-primary" />
                <span>{item.label}</span>
                <span className="opacity-70">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {visibleJoinError ? (
          <div className="rounded-2xl border border-base-300 bg-base-100 p-8 text-center shadow-sm">
            <p className="font-medium" role="alert">
              {visibleJoinError}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={retryJoining}
              >
                Retry joining
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={goToChat}
              >
                Return to chat
              </button>
            </div>
          </div>
        ) : videoClient && call ? (
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[1.6fr_0.8fr]">
            {mediaError && (
              <div className="alert alert-warning lg:col-span-2" role="alert">
                <span>{mediaError}</span>
              </div>
            )}
            <div className="order-1 flex flex-col overflow-hidden rounded-3xl border border-base-300 bg-base-100 shadow-xl lg:order-none">
              <div className="flex items-center justify-between border-b border-base-300 px-4 py-3 text-sm">
                <div className="flex items-center gap-2">
                  {!isVoice ? (
                    <>
                      <Video className="h-4 w-4 text-primary" />
                      <span className="hidden sm:inline">
                        Secure meeting • screen sharing • reactions
                      </span>
                      <span className="sm:hidden">Video call</span>
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4 text-primary" />
                      <span>High quality voice</span>
                    </>
                  )}
                </div>
              </div>
              <div className="relative min-h-[400px] flex-1 overflow-hidden bg-base-200/70 flex flex-col sm:min-h-[560px]">
                <StreamVideo client={videoClient}>
                  <StreamCall call={call}>
                    <CallStateObserver
                      onCallingStateChange={handleCallingStateChange}
                    />
                    <StreamTheme>
                      {!isVoice ? (
                        <>
                          <SpeakerLayout participantBarPosition="bottom" />
                          <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-wrap items-center justify-center gap-2 bg-gradient-to-t from-base-900/80 to-transparent px-3 py-4 sm:px-4 sm:py-6">
                            <CallMediaControls
                              isVoice={false}
                              onLeave={handleLeaveCall}
                              onMediaError={handleMediaError}
                            />
                            {cameraDevices.length > 1 && (
                              <select
                                className="select select-sm select-bordered h-11 min-w-[120px]"
                                value={selectedCameraDeviceId || ""}
                                onChange={(event) =>
                                  handleSwitchCamera(event.target.value)
                                }
                                disabled={switchingCamera}
                              >
                                {cameraDevices.map((device) => (
                                  <option
                                    key={device.deviceId}
                                    value={device.deviceId}
                                  >
                                    {device.label ||
                                      `Camera ${device.deviceId.slice(0, 4)}`}
                                  </option>
                                ))}
                              </select>
                            )}
                            {supportsScreenShare && (
                              <button
                                type="button"
                                onClick={handleScreenShare}
                                disabled={!call}
                                className={`btn btn-sm min-h-11 px-4 gap-2 ${
                                  isScreenSharing
                                    ? "btn-warning"
                                    : "btn-ghost hover:bg-base-700"
                                }`}
                                title={
                                  isScreenSharing
                                    ? "Stop sharing"
                                    : "Share screen"
                                }
                              >
                                <ScreenShare className="h-4 w-4" />
                                <span className="hidden sm:inline">
                                  {isScreenSharing ? "Stop" : "Share"}
                                </span>
                              </button>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-4 px-4">
                          <div className="w-full min-h-48 max-h-[360px] flex-1 overflow-hidden">
                            <SpeakerLayout participantsBarPosition="bottom" />
                          </div>
                          <div className="flex flex-col items-center gap-3">
                            <Mic className="h-12 w-12 text-primary" />
                            <h3 className="text-lg font-semibold">
                              Voice call
                            </h3>
                            <p className="break-all text-sm opacity-70">
                              Room: {id || "unknown"}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                            <CallMediaControls
                              isVoice
                              onLeave={handleLeaveCall}
                              onMediaError={handleMediaError}
                            />
                          </div>
                          {cameraSelectionError && (
                            <p className="text-xs text-error text-center">
                              {cameraSelectionError}
                            </p>
                          )}
                          {mediaError && (
                            <p
                              className="max-w-md text-center text-xs text-warning"
                              role="status"
                            >
                              {mediaError}
                            </p>
                          )}
                        </div>
                      )}
                    </StreamTheme>
                  </StreamCall>
                </StreamVideo>
              </div>
            </div>

            <aside className="order-2 flex flex-col gap-3 lg:order-none">
              <div className="rounded-3xl border border-base-300 bg-base-100 p-3 shadow-sm sm:p-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm sm:text-base">
                    Meeting essentials
                  </h3>
                </div>
                <div className="mt-3 space-y-2 text-xs sm:text-sm text-base-content/70">
                  <div className="flex items-center justify-between rounded-xl bg-base-200 px-3 py-2">
                    <span>Connection</span>
                    <span className="font-medium text-success">Stable</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-base-200 px-3 py-2">
                    <span>Audio</span>
                    <span className="font-medium text-base-content">Ready</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-base-200 px-3 py-2">
                    <span>Room</span>
                    <span className="min-w-0 truncate font-medium text-base-content">
                      {id || "unknown"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-base-300 bg-base-100 p-3 shadow-sm sm:p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium sm:text-sm">Recordings</p>
                  <div className="flex items-center gap-1 sm:gap-2">
                    <button
                      className="btn btn-ghost btn-xs sm:btn-sm h-10 sm:h-11"
                      onClick={async () => {
                        setRecordingLoading(true);
                        try {
                          await call?.startRecording(
                            recordingDestination
                              ? {
                                  recording_external_storage:
                                    recordingDestination,
                                }
                              : undefined,
                          );
                          await refreshRecordings();
                        } catch (e) {
                          console.error("startRecording failed", e);
                        } finally {
                          setRecordingLoading(false);
                        }
                      }}
                    >
                      Start
                    </button>
                    <button
                      className="btn btn-ghost btn-xs sm:btn-sm h-10 sm:h-11"
                      onClick={async () => {
                        setRecordingLoading(true);
                        try {
                          await call?.stopRecording();
                          await refreshRecordings();
                        } catch (e) {
                          console.error("stopRecording failed", e);
                        } finally {
                          setRecordingLoading(false);
                        }
                      }}
                    >
                      Stop
                    </button>
                    <button
                      className="btn btn-ghost btn-xs sm:btn-sm h-10 sm:h-11"
                      onClick={async () => {
                        setRecordingLoading(true);
                        try {
                          await refreshRecordings();
                        } catch (e) {
                          console.error("refreshRecordings failed", e);
                        } finally {
                          setRecordingLoading(false);
                        }
                      }}
                    >
                      Refresh
                    </button>
                  </div>
                </div>

                <div className="mt-3">
                  <CallRecordingList
                    callRecordings={recordings}
                    loading={recordingLoading}
                    onRefresh={async () => {
                      setRecordingLoading(true);
                      try {
                        await refreshRecordings();
                      } catch (e) {
                        console.error(e);
                      } finally {
                        setRecordingLoading(false);
                      }
                    }}
                  />

                  {recordings.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {recordings.map((recording, index) => {
                        const recordingKey = recording?.id || index;
                        const isSaving = savingRecordingId === recordingKey;

                        return (
                          <div
                            key={recordingKey}
                            className="flex items-center justify-between gap-2 rounded-xl border border-base-300 bg-base-200 px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs sm:text-sm font-medium">
                                {getRecordingName(recording)}
                              </p>
                              <p className="text-xs opacity-70">
                                {recording?.status || "Ready"}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs h-10 gap-1 shrink-0"
                              onClick={() =>
                                saveRecordingToDevice(recording, index)
                              }
                              disabled={isSaving}
                            >
                              <Download className="h-3.5 w-3.5" />
                              {isSaving ? "Saving..." : "Save"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </aside>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default CallPage;
