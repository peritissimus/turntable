import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  vite: {
    build: {
      chunkSizeWarningLimit: 750,
      rollupOptions: {
        onwarn(warning, warn) {
          // DialKit and Motion ship framework hints for SSR-aware bundlers.
          // This app is client-only, so Rollup can safely ignore them.
          if (warning.code === "MODULE_LEVEL_DIRECTIVE" && warning.message.includes("use client")) return;
          warn(warning);
        },
      },
    },
  },
});
