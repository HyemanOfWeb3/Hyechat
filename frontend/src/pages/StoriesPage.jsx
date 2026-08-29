import { Image, Loader2 } from "lucide-react";
import useStreamClient from "../hooks/useStreamClient.js";
import useAuthUser from "../hooks/useAuthUser.js";
import StoriesBar from "../components/stories/StoriesBar.jsx";

const StoriesPage = () => {
  const { authUser } = useAuthUser();

  const { client: streamClient, connectionState, error: streamError } =
    useStreamClient();
  const chatClient =
    authUser && streamClient && connectionState === "connected"
      ? streamClient
      : null;

  return (
    <div className="w-full overflow-y-auto bg-base-100 px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="border-b border-base-300 pb-5">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Moments
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-bold">
            <Image className="size-7 text-primary" /> Stories
          </h1>
          <p className="mt-2 text-sm opacity-60">
            Share a moment and see what your friends are learning around the
            world.
          </p>
        </header>
        {streamError ? (
          <div className="alert alert-error">{streamError}</div>
        ) : chatClient ? (
          <StoriesBar chatClient={chatClient} />
        ) : (
          <div className="flex justify-center py-16">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        )}
      </div>
    </div>
  );
};

export default StoriesPage;
