import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { workspaceBinsPlugin } from "./vite-plugin-workspace-bins.js";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), workspaceBinsPlugin(path.resolve(__dirname, "bins"))],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    hmr: {
      overlay: true,
    },
  },
});
