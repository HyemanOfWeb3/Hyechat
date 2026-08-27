import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // stream-chat-react is distributed as a single large module.
    chunkSizeWarningLimit: 1300,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;

          if (id.includes("stream-chat-react"))
            return "stream-chat-react-vendor";
          if (id.includes("stream-chat/")) return "stream-chat-core-vendor";

          if (id.includes("@stream-io")) return "stream-video-vendor";

          return undefined;
        },
      },
    },
  },
});
