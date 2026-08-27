import { useEffect, useState } from "react";
import { StreamChat } from "stream-chat";
import { Image, Loader2 } from "lucide-react";
import { getStreamToken } from "../lib/api.js";
import useAuthUser from "../hooks/useAuthUser.js";
import StoriesBar from "../components/stories/StoriesBar.jsx";

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

const StoriesPage = () => {
  const { authUser } = useAuthUser();
  const [chatClient, setChatClient] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authUser || !STREAM_API_KEY) return undefined;
    let active = true;

    const connect = async () => {
      try {
        const tokenData = await getStreamToken();
        if (!tokenData?.token) throw new Error("Unable to load story tools");
        const client = StreamChat.getInstance(STREAM_API_KEY);
        if (client.userID !== authUser._id) {
          await client.connectUser(
            {
              id: authUser._id,
              name: authUser.fullName,
              image: authUser.profilePic,
            },
            tokenData.token,
          );
        }
        if (active) setChatClient(client);
      } catch (connectionError) {
        console.error("Could not connect to story tools", connectionError);
        if (active) setError("Stories are temporarily unavailable.");
      }
    };

    connect();
    return () => {
      active = false;
    };
  }, [authUser]);

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
        {error ? (
          <div className="alert alert-error">{error}</div>
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
