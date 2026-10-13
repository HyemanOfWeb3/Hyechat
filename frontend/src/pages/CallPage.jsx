import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  PanelRightClose,
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
  CallControls,
  SpeakerLayout,
  StreamCall,
  StreamTheme,
  StreamVideo,
  CallRecordingList,
  CallingState,
  useCallStateHooks,
} from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";

import { getStreamToken } from "../lib/api.js";
import { endCallHistory, startCallHistory } from "../lib/api.js";
import useAuthUser from "../hooks/useAuthUser.js";
import ChatLoader from "../components/ChatLoader.jsx";
import { getStreamVideoClient } from "../lib/streamVideoClient.js";

const meetingHighlights = [
  { label: "HD video", value: "Enabled" },
  { label: "Noise reduction", value: "On" },
  { label: "Instant reactions", value: "Ready" },
];

const CallPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const callType = searchParams.get("type") || "video";
  const chatId = searchParams.get("chatId") || id;
  const isVoice = callType === "voice";

  const { authUser, isLoading: authLoading } = useAuthUser();
  const keepCallAliveRef = useRef(false);
  const historyStartedRef = useRef(false);
  const historyEndedRef = useRef(false);
  const { data: tokenData, isLoading: tokenLoading } = useQuery({
    queryKey: ["streamToken"],
    queryFn: getStreamToken,
    enabled: !!authUser,
  });
  const { useCallState } = useCallStateHooks();
  const callingState = useCallState();

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
    if (!chatId) return;
    window.location.assign(`/chat/${chatId}?refresh=${Date.now()}`);
  }, [chatId]);

  const handleBackToChat = () => {
    if (!chatId) return;
    keepCallAliveRef.current = true;
    window.location.assign(`/chat/${chatId}?refresh=${Date.now()}`);
  };

  const handleLeaveCall = async () => {
    keepCallAliveRef.current = false;
    try {
      if (call?.leave) await call.leave({ reason: "local" });
      if (historyStartedRef.current && !historyEndedRef.current) {
        historyEndedRef.current = true;
        await endCallHistory(id);
      }
    } catch (e) {
      console.error("Error leaving call", e);
    } finally {
      setVideoClient(null);
      setCall(null);
      goToChat();
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

  useEffect(() => {
    if (
      (callingState === CallingState.ENDED ||
        callingState === CallingState.LEFT) &&
      chatId
    ) {
      goToChat();
    }
  }, [callingState, chatId, goToChat]);

  useEffect(() => {
    if (
      callingState !== CallingState.ENDED &&
      callingState !== CallingState.LEFT
    )
      return;
    if (!historyStartedRef.current || historyEndedRef.current) return;
    historyEndedRef.current = true;
    endCallHistory(id).catch((error) =>
      console.error("Could not finalize call history", error),
    );
  }, [callingState, id]);

  useEffect(() => {
    const loadCameraDevices = async () => {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(
          (device) => device.kind === "videoinput" && device.deviceId,
        );
        setCameraDevices(videoInputs);
        setSelectedCameraDeviceId(videoInputs[0]?.deviceId || null);
      } catch (error) {
        console.error("Failed to load camera devices", error);
      }
    };

    loadCameraDevices();
  }, []);

  useEffect(() => {
    if (authLoading || tokenLoading || !authUser || !tokenData?.token || !id) {
      return;
    }

    let isActive = true;

    let videoCall;

    const joinCall = async () => {
      try {
        const client = await getStreamVideoClient({
          user: authUser,
          token: tokenData.token,
        });
        videoCall = client.call("default", id);
        await videoCall.join({ create: true });
        if (!historyStartedRef.current) {
          try {
            await startCallHistory({
              roomId: id,
              callType: isVoice ? "voice" : "video",
            });
          } catch (historyError) {
            console.error("Could not save call history", historyError);
          }
          historyStartedRef.current = true;
        }
        if (isActive) {
          setVideoClient(client);
          setCall(videoCall);
        }
      } catch (error) {
        console.error("Unable to join Stream call:", error);
        if (isActive) {
          setJoinError("Unable to join the call right now. Please try again.");
        }
      }
    };

    joinCall();

    return () => {
      isActive = false;
      if (keepCallAliveRef.current) {
        keepCallAliveRef.current = false;
        return;
      }
      videoCall?.leave().catch(() => {});
      setVideoClient(null);
      setCall(null);
    };
  }, [authLoading, authUser, id, isVoice, tokenData, tokenLoading]);

  if (authLoading || tokenLoading || (!videoClient && !joinError)) {
    return <ChatLoader />;
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
              <div className="badge badge-success gap-2">
                <Users className="h-3.5 w-3.5" />
                Live
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm gap-2"
                onClick={handleBackToChat}
              >
                <PanelRightClose className="h-4 w-4" />
                Back
              </button>
              <button
                type="button"
                className="btn btn-error btn-sm gap-2"
                onClick={handleLeaveCall}
              >
                <PhoneOff className="h-4 w-4" />
                End call
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

        {joinError ? (
          <div className="rounded-2xl border border-base-300 bg-base-100 p-8 text-center shadow-sm">
            <p className="font-medium">{joinError}</p>
          </div>
        ) : videoClient && call ? (
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[1.6fr_0.8fr]">
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
                    <StreamTheme>
                      {!isVoice ? (
                        <>
                          <SpeakerLayout participantBarPosition="bottom" />
                          <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-wrap items-center justify-center gap-2 bg-gradient-to-t from-base-900/80 to-transparent px-3 py-4 sm:px-4 sm:py-6">
                            <CallControls onLeave={handleLeaveCall} />
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
                            <CallControls onLeave={handleLeaveCall} />
                            {cameraDevices.length > 1 && (
                              <select
                                className="select select-sm select-bordered h-11"
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
                          </div>
                          {cameraSelectionError && (
                            <p className="text-xs text-error text-center">
                              {cameraSelectionError}
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
