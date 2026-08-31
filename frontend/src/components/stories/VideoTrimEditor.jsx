import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, Play, X } from "lucide-react";

const MAX_TRIM_DURATION_SECONDS = 60;

/**
 * VideoTrimEditor: Mobile-friendly video trimming component
 * Allows users to select a portion of a video (max 60 seconds)
 * Note: The UI provides trim selection and preview, but actual video re-encoding
 * would require either ffmpeg.wasm or a backend trimming service
 */
const VideoTrimEditor = ({ videoFile, onComplete, onCancel }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
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
      const duration = Math.ceil(video.duration);
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
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    const updateCanvas = () => {
      if (video.readyState >= 2) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
    };

    video.addEventListener("seeked", updateCanvas);
    video.addEventListener("timeupdate", updateCanvas);
    updateCanvas();

    return () => {
      video.removeEventListener("seeked", updateCanvas);
      video.removeEventListener("timeupdate", updateCanvas);
    };
  }, []);

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

  const handleTimelineClick = (e) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const clickTime = percentage * videoDuration;

    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(clickTime, videoDuration));
    }
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
          const newStart = Math.min(time, endTime - 1);
          setStartTime(Math.max(0, newStart));
          if (videoRef.current) {
            videoRef.current.currentTime = newStart;
          }
        } else if (draggedHandle.current === "end") {
          const newEnd = Math.max(time, startTime + 1);
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
    [endTime, startTime, videoDuration]
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
          const newStart = Math.min(time, endTime - 1);
          setStartTime(Math.max(0, newStart));
        } else if (draggedHandle.current === "end") {
          const newEnd = Math.max(time, startTime + 1);
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
    [endTime, startTime, videoDuration]
  );

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const selectedDuration = Math.round((endTime - startTime) * 10) / 10;

  const handleTrimAndContinue = async () => {
    if (selectedDuration > MAX_TRIM_DURATION_SECONDS) {
      setError("Selected duration exceeds 60 seconds");
      return;
    }

    setIsTrimming(true);
    setError("");

    try {
      // For a complete implementation, you would need either:
      // 1. ffmpeg.wasm (~3MB): https://ffmpegwasm.netlify.app/
      // 2. Backend API endpoint that trims the video server-side
      // 3. Third-party video service
      
      // For now, we attach trim metadata to the file and let the backend handle it
      // Create a new file object with trim metadata
      const trimmedFile = new File([videoFile], videoFile.name, { type: videoFile.type });
      
      // Attach trim start/end as custom properties
      Object.defineProperty(trimmedFile, "trimStart", { value: startTime, writable: false });
      Object.defineProperty(trimmedFile, "trimEnd", { value: endTime, writable: false });
      Object.defineProperty(trimmedFile, "originalDuration", { value: videoDuration, writable: false });

      // For production:
      // 1. If you have ffmpeg.wasm installed, uncomment and use it
      // 2. Or upload to backend with trim parameters for server-side processing
      
      onComplete(trimmedFile);
    } catch (err) {
      console.error("Error processing video:", err);
      setError(err.message || "Failed to process video. Please try again.");
      setIsTrimming(false);
    }
  };

  const startPercentage = (startTime / videoDuration) * 100;
  const endPercentage = (endTime / videoDuration) * 100;

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
          <canvas
            ref={canvasRef}
            width={320}
            height={480}
            className="max-h-full max-w-full rounded"
          />
        </div>

        {/* Hidden video element */}
        <video
          ref={videoRef}
          className="hidden"
          playsInline
          crossOrigin="anonymous"
        />

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
              className="absolute size-8 -translate-x-1/2 cursor-grab active:cursor-grabbing rounded-full bg-primary shadow-lg"
              style={{ left: `${startPercentage}%`, top: "50%", transform: "translate(-50%, -50%)" }}
              onMouseDown={handleMouseDown("start")}
              onTouchStart={handleTouchStart("start")}
              role="slider"
              aria-label="Trim start"
              aria-valuemin="0"
              aria-valuemax={videoDuration}
              aria-valuenow={Math.round(startTime)}
            />

            {/* End handle */}
            <div
              className="absolute size-8 -translate-x-1/2 cursor-grab active:cursor-grabbing rounded-full bg-primary shadow-lg"
              style={{ left: `${endPercentage}%`, top: "50%", transform: "translate(-50%, -50%)" }}
              onMouseDown={handleMouseDown("end")}
              onTouchStart={handleTouchStart("end")}
              role="slider"
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
            <Play className="size-4" />
            {isPlaying ? "Playing..." : "Preview"}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <p className="px-4 py-2 text-sm text-error text-center">{error}</p>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 px-4 py-3">
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
            onClick={handleTrimAndContinue}
            disabled={isTrimming || selectedDuration > MAX_TRIM_DURATION_SECONDS}
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
