import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve(import.meta.dirname),
  plugins: [react()],
  resolve: {
    alias: {
      "wxt/browser": resolve(import.meta.dirname, "wxt-browser-shim.ts"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5179,
    strictPort: true,
  },
  clearScreen: false,
});
