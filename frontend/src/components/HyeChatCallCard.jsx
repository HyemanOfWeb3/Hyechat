import { Mic, Video } from "lucide-react";

const HyeChatCallCard = ({ callType, createdBy, url }) => {
  const isVideoCall = callType === "video";
  const CallIcon = isVideoCall ? Video : Mic;
  const callLabel = isVideoCall ? "Video call" : "Voice call";
  const joinLabel = isVideoCall ? "Join video call" : "Join call";

  return (
    <div className="hyechat-call-card w-full max-w-full overflow-hidden rounded-2xl border border-primary/20 bg-base-100 p-4 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CallIcon className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold">HyeChat Call</p>
          <p className="text-sm opacity-70">{callLabel}</p>
        </div>
      </div>
      <div className="mt-3 flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0 text-sm">
          <p className="truncate opacity-70">
            Started by {createdBy || "a HyeChat user"}
          </p>
          <p className="mt-1 flex items-center gap-2 font-medium text-success">
            <span
              className="size-2 shrink-0 rounded-full bg-success"
              aria-hidden="true"
            />
            Ready to join
          </p>
        </div>
        <a
          href={url}
          className="btn btn-primary min-h-11 shrink-0 px-4"
          aria-label={`Join HyeChat ${isVideoCall ? "video" : "voice"} call`}
        >
          {joinLabel}
        </a>
      </div>
    </div>
  );
};

export default HyeChatCallCard;
