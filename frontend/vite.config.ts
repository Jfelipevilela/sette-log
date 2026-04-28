import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  envDir: "..",
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: ["localhost", "rdlcspfxv.localto.net"],
  },
  preview: {
    host: "0.0.0.0",
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          query: ["@tanstack/react-query", "axios", "zustand"],
          charts: ["recharts"],
          maps: ["leaflet", "react-leaflet"],
        },
      },
    },
  },
});
