import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, Pause, Play, RotateCcw, X } from "lucide-react";

const MAX_TRIM_DURATION_SECONDS = 60;

const waitForVideoMetadata = (video) =>
  new Promise((resolve, reject) => {
    const handleLoaded = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("Unable to load the selected video for trimming."));
    };
    const cleanup = () => {
      video.removeEventListener("loadedmetadata", handleLoaded);
      video.removeEventListener("error", handleError);
    };

    video.addEventListener("loadedmetadata", handleLoaded);
    video.addEventListener("error", handleError);
    if (video.readyState >= 1) {
      cleanup();
      resolve();
    }
  });

const seekVideo = (video, time) =>
  new Promise((resolve, reject) => {
    if (Math.abs(video.currentTime - time) < 0.01) {
      resolve();
      return;
    }
    const handleSeeked = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("The selected video could not be trimmed."));
    };
    const cleanup = () => {
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("error", handleError);
    };

    video.addEventListener("seeked", handleSeeked);
    video.addEventListener("error", handleError);
    video.currentTime = time;
  });

const readVideoDuration = (blob) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = video.duration;
      cleanup();
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error("The trimmed video has invalid media data."));
        return;
      }
      resolve(duration);
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("The browser could not verify the trimmed video."));
    };
    video.src = url;
  });

const trimVideoToFile = async (videoFile, startTime, endTime) => {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("Video trimming is not supported by this browser.");
  }
  const sourceUrl = URL.createObjectURL(videoFile);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = false;
  video.playsInline = true;
  video.src = sourceUrl;
  let capturedStream;

  try {
    await waitForVideoMetadata(video);

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (duration <= 0) throw new Error("This video has an invalid duration.");
    const minimumSegmentLength = Math.min(1, duration);
    const actualStart = Math.max(
      0,
      Math.min(startTime, duration - minimumSegmentLength),
    );
    const actualEnd = Math.min(
      duration,
      Math.max(actualStart + minimumSegmentLength, endTime),
    );
    if (actualEnd - actualStart > MAX_TRIM_DURATION_SECONDS) {
      throw new Error("Choose a video segment between 1 and 60 seconds.");
    }

    const stream = video.captureStream?.() ?? video.mozCaptureStream?.();
    if (!stream) {
      throw new Error("This browser does not support video trimming.");
    }
    capturedStream = stream;

    const mimeType = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
    ].find((type) => MediaRecorder.isTypeSupported(type));
    if (!mimeType) {
      throw new Error("This browser does not provide a supported video encoder.");
    }

    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    await seekVideo(video, actualStart);
    try {
      await video.play();
      video.pause();
      await seekVideo(video, actualStart);
    } catch {
      throw new Error("Allow video playback in this browser to trim the file.");
    }

    const trimmedBlob = await new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        recorder.stop();
        reject(new Error("Video trimming timed out. Try a shorter segment."));
      }, Math.max(15000, (actualEnd - actualStart) * 1500 + 5000));

      recorder.onerror = () => {
        window.clearTimeout(timeoutId);
        reject(new Error("The video could not be trimmed successfully."));
      };

      recorder.onstop = () => {
        window.clearTimeout(timeoutId);
        const blob = new Blob(chunks, {
          type: recorder.mimeType || "video/webm",
        });
        resolve(blob);
      };

      recorder.start();
      video.play().catch(() => {
        window.clearTimeout(timeoutId);
        if (recorder.state !== "inactive") recorder.stop();
        reject(new Error("Video playback was blocked while trimming."));
      });

      const checkProgress = () => {
        if (recorder.state === "inactive") return;
        if (video.currentTime >= actualEnd) {
          video.pause();
          recorder.stop();
          return;
        }
        requestAnimationFrame(checkProgress);
      };

      requestAnimationFrame(checkProgress);
    });

    if (!trimmedBlob.size) {
      throw new Error("The browser produced an empty trimmed video.");
    }
    const outputDuration = await readVideoDuration(trimmedBlob);
    const selectedDuration = actualEnd - actualStart;
    if (Math.abs(outputDuration - selectedDuration) > 1.5) {
      throw new Error("The trimmed video did not match the selected duration.");
    }
    if (outputDuration > MAX_TRIM_DURATION_SECONDS + 0.5) {
      throw new Error("The encoded clip exceeded 60 seconds. Trim a shorter section.");
    }

    const extension = mimeType.includes("mp4") ? "mp4" : "webm";
    return new File(
      [trimmedBlob],
      `${videoFile.name.replace(/\.[^.]+$/, "")}-trimmed.${extension}`,
      { type: trimmedBlob.type || mimeType },
    );
  } finally {
    capturedStream?.getTracks().forEach((track) => track.stop());
    video.pause();
    video.src = "";
    URL.revokeObjectURL(sourceUrl);
  }
};

const VideoTrimEditor = ({ videoFile, onComplete, onCancel }) => {
  const videoRef = useRef(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTrimming, setIsTrimming] = useState(false);
  const [error, setError] = useState("");
  const draggedHandle = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current || !videoFile) return;

    const video = videoRef.current;
    const url = URL.createObjectURL(videoFile);
    video.src = url;

    const handleLoadedMetadata = () => {
      const duration = video.duration;
      setVideoDuration(duration);
      const end = Math.min(duration, MAX_TRIM_DURATION_SECONDS);
      setStartTime(0);
      setEndTime(end);
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      URL.revokeObjectURL(url);
    };
  }, [videoFile]);

  useEffect(() => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const updatePlayback = () => {
      if (isPlaying && video.currentTime >= endTime) {
        video.pause();
        setIsPlaying(false);
        video.currentTime = startTime;
      }
    };

    if (isPlaying) {
      if (video.currentTime < startTime) {
        video.currentTime = startTime;
      }
      video.play().catch((err) => {
        console.error("Error playing video:", err);
        setIsPlaying(false);
      });
    } else {
      video.pause();
    }

    video.addEventListener("timeupdate", updatePlayback);
    return () => video.removeEventListener("timeupdate", updatePlayback);
  }, [isPlaying, startTime, endTime]);

  const minimumSelectionLength = Math.min(1, videoDuration);

  const handleTimelineClick = (e) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const clickTime = percentage * videoDuration;

    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(
        0,
        Math.min(clickTime, videoDuration),
      );
    }
  };

  const handleSliderKeyDown = (handle) => (event) => {
    const increments = {
      ArrowLeft: -1,
      ArrowDown: -1,
      ArrowRight: 1,
      ArrowUp: 1,
    };
    const increment = increments[event.key];
    if (increment === undefined && event.key !== "Home" && event.key !== "End") {
      return;
    }
    event.preventDefault();

    if (handle === "start") {
      const requestedTime =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? endTime - minimumSelectionLength
            : startTime + increment * (event.shiftKey ? 5 : 1);
      const nextTime = Math.max(
        0,
        Math.min(requestedTime, endTime - minimumSelectionLength),
      );
      setStartTime(nextTime);
      if (videoRef.current) videoRef.current.currentTime = nextTime;
      return;
    }

    const requestedTime =
      event.key === "Home"
        ? startTime + minimumSelectionLength
        : event.key === "End"
          ? videoDuration
          : endTime + increment * (event.shiftKey ? 5 : 1);
    const nextTime = Math.max(
      startTime + minimumSelectionLength,
      Math.min(requestedTime, videoDuration),
    );
    setEndTime(nextTime);
    if (videoRef.current) videoRef.current.currentTime = nextTime;
  };

  const handleMouseDown = useCallback(
    (handle) => (e) => {
      e.preventDefault();
      draggedHandle.current = handle;

      const handleMouseMove = (moveEvent) => {
        if (!containerRef.current || draggedHandle.current === null) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = moveEvent.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, x / rect.width));
        const time = percentage * videoDuration;

        if (draggedHandle.current === "start") {
          const newStart = Math.min(time, endTime - minimumSelectionLength);
          setStartTime(Math.max(0, newStart));
          if (videoRef.current) {
            videoRef.current.currentTime = newStart;
          }
        } else if (draggedHandle.current === "end") {
          const newEnd = Math.max(time, startTime + minimumSelectionLength);
          setEndTime(Math.min(videoDuration, newEnd));
          if (videoRef.current) {
            videoRef.current.currentTime = newEnd;
          }
        }
      };

      const handleMouseUp = () => {
        draggedHandle.current = null;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [endTime, minimumSelectionLength, startTime, videoDuration],
  );

  const handleTouchStart = useCallback(
    (handle) => () => {
      draggedHandle.current = handle;

      const handleTouchMove = (moveEvent) => {
        if (!containerRef.current || draggedHandle.current === null) return;

        const touch = moveEvent.touches[0];
        const rect = containerRef.current.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, x / rect.width));
        const time = percentage * videoDuration;

        if (draggedHandle.current === "start") {
          const newStart = Math.min(time, endTime - minimumSelectionLength);
          setStartTime(Math.max(0, newStart));
        } else if (draggedHandle.current === "end") {
          const newEnd = Math.max(time, startTime + minimumSelectionLength);
          setEndTime(Math.min(videoDuration, newEnd));
        }
      };

      const handleTouchEnd = () => {
        draggedHandle.current = null;
        document.removeEventListener("touchmove", handleTouchMove);
        document.removeEventListener("touchend", handleTouchEnd);
      };

      document.addEventListener("touchmove", handleTouchMove);
      document.addEventListener("touchend", handleTouchEnd);
    },
    [endTime, minimumSelectionLength, startTime, videoDuration],
  );

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const selectedDuration = Math.round((endTime - startTime) * 10) / 10;

  const resetTrim = () => {
    const resetEnd = Math.min(videoDuration, MAX_TRIM_DURATION_SECONDS);
    setStartTime(0);
    setEndTime(resetEnd);
    setIsPlaying(false);
    setError("");
    if (videoRef.current) videoRef.current.currentTime = 0;
  };

  const handleTrimAndContinue = async () => {
    if (selectedDuration > MAX_TRIM_DURATION_SECONDS) {
      setError("Selected duration exceeds 60 seconds");
      return;
    }

    setIsTrimming(true);
    setError("");

    try {
      const trimmedFile = await trimVideoToFile(videoFile, startTime, endTime);
      onComplete(trimmedFile);
    } catch (err) {
      console.error("Error processing video:", err);
      setError(err.message || "Failed to process video. Please try again.");
      setIsTrimming(false);
    }
  };

  const startPercentage = videoDuration ? (startTime / videoDuration) * 100 : 0;
  const endPercentage = videoDuration ? (endTime / videoDuration) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3">
      <div className="relative flex h-[min(600px,calc(100dvh-1.5rem))] w-full max-w-lg flex-col rounded-2xl border border-base-300 bg-base-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-base-300 px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isTrimming}
            className="btn btn-ghost btn-sm gap-1"
          >
            <ChevronLeft className="size-4" />
            Back
          </button>
          <h3 className="font-semibold">Trim Video</h3>
          <div className="w-16" />
        </div>

        {/* Video Preview */}
        <div className="flex-1 flex items-center justify-center bg-black p-2">
          <video
            ref={videoRef}
            className="max-h-full max-w-full rounded object-contain"
            playsInline
            preload="metadata"
          />
        </div>

        {/* Duration Info */}
        <div className="flex flex-col gap-3 px-4 py-3 border-b border-base-300">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{formatTime(startTime)}</span>
            <span className="text-center font-semibold text-primary">
              {Math.round(selectedDuration)}s / {MAX_TRIM_DURATION_SECONDS}s
            </span>
            <span className="font-medium">{formatTime(endTime)}</span>
          </div>

          {/* Timeline */}
          <div
            ref={containerRef}
            className="relative flex items-center h-12 bg-base-200 rounded cursor-pointer touch-none"
            onClick={handleTimelineClick}
          >
            <div className="absolute inset-0 flex items-center px-1">
              <div className="h-1 flex-1 bg-base-300 rounded-full" />
            </div>

            <div
              className="absolute h-1 bg-primary rounded-full"
              style={{
                left: `calc(${startPercentage}% + 4px)`,
                right: `calc(${100 - endPercentage}% + 4px)`,
                top: "50%",
                transform: "translateY(-50%)",
              }}
            />

            {/* Start handle */}
            <div
              className="absolute size-8 -translate-x-1/2 cursor-grab rounded-full bg-primary shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-base-content"
              style={{
                left: `${startPercentage}%`,
                top: "50%",
                transform: "translate(-50%, -50%)",
              }}
              onMouseDown={handleMouseDown("start")}
              onTouchStart={handleTouchStart("start")}
              onKeyDown={handleSliderKeyDown("start")}
              role="slider"
              tabIndex={0}
              aria-label="Trim start"
              aria-valuemin="0"
              aria-valuemax={videoDuration}
              aria-valuenow={Math.round(startTime)}
            />

            {/* End handle */}
            <div
              className="absolute size-8 -translate-x-1/2 cursor-grab rounded-full bg-primary shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-base-content"
              style={{
                left: `${endPercentage}%`,
                top: "50%",
                transform: "translate(-50%, -50%)",
              }}
              onMouseDown={handleMouseDown("end")}
              onTouchStart={handleTouchStart("end")}
              onKeyDown={handleSliderKeyDown("end")}
              role="slider"
              tabIndex={0}
              aria-label="Trim end"
              aria-valuemin="0"
              aria-valuemax={videoDuration}
              aria-valuenow={Math.round(endTime)}
            />
          </div>
        </div>

        {/* Preview Button */}
        <div className="flex items-center justify-center px-4 py-2 border-b border-base-300">
          <button
            type="button"
            onClick={() => {
              if (videoRef.current) {
                videoRef.current.currentTime = startTime;
              }
              setIsPlaying(!isPlaying);
            }}
            disabled={isTrimming}
            className="btn btn-sm btn-primary gap-2"
          >
            {isPlaying ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4" />
            )}
            {isPlaying ? "Pause preview" : "Preview selected section"}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <p className="px-4 py-2 text-sm text-error text-center">{error}</p>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isTrimming}
            className="btn btn-outline flex-1"
          >
            <X className="size-4" />
            Cancel
          </button>
          <button
            type="button"
            onClick={resetTrim}
            disabled={isTrimming}
            className="btn btn-ghost"
            aria-label="Reset trim selection"
          >
            <RotateCcw className="size-4" />
            Reset
          </button>
          <button
            type="button"
            onClick={handleTrimAndContinue}
            disabled={
              isTrimming || selectedDuration > MAX_TRIM_DURATION_SECONDS
            }
            className="btn btn-primary flex-1"
          >
            {isTrimming ? (
              <>
                <span className="loading loading-spinner loading-sm" />
                Processing...
              </>
            ) : (
              "Trim & Continue"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoTrimEditor;
