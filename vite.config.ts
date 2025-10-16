// File: ./vite.config.ts
import { defineConfig } from "vite";

// No more complex pathing or root changes are needed.
export default defineConfig({
  // The 'public' directory is now just for static assets that get copied to the build.
  // It is no longer the server root.

  build: {
    outDir: "dist",
    emptyOutDir: true,
  },

  server: {
    port: 5173,
  },
});
