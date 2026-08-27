import { VideoIcon } from "lucide-react";

function CallButton({ handleVideoCall }) {
  return (
    // <div className="absolute right-4 top-4 z-10">
    //   <button
    //     type="button"
    //     onClick={handleVideoCall}
    //     className="btn btn-success btn-sm text-white flex items-center gap-2"
    //   >
    //     <VideoIcon className="h-4 w-4" />
    //     <span>Call</span>
    //   </button>
    // </div>

    // <div className="p-3 border-b flex items-center justify-end max-w-7xl mx-auto w-full absolute top-0">
    <div className="absolute right-4 top-4 z-10">
      <button
        onClick={handleVideoCall}
        className="btn btn-success btn-sm text-white"
      >
        <VideoIcon className="size-6" />
      </button>
    </div>
  );
}

export default CallButton;
