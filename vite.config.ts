import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { workspaceBinsPlugin } from "./vite-plugin-workspace-bins.js";
import { massiveApiPlugin } from "./vite-plugin-massive-api.js";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), workspaceBinsPlugin(path.resolve(__dirname, "bins")), massiveApiPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        dollaraday: path.resolve(__dirname, "dollaraday.html"),
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    open: "/dollaraday.html",
    watch: {
      ignored: ["**/bins/**", "**/dist/**", "**/.git/**"],
      usePolling: false,
    },
    hmr: {
      host: "localhost",
      port: 5173,
      clientPort: 5173,
      overlay: true,
    },
  },
});
