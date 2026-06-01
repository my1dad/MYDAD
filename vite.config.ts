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
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        roadmap: path.resolve(__dirname, "roadmap.html"),
        preloaderDev: path.resolve(__dirname, "preloader-dev.html"),
        freshReset: path.resolve(__dirname, "fresh-reset.html"),
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    open: "/roadmap.html",
    watch: {
      // Workspace bin writes must not trigger full-page reload loops in dev.
      ignored: ["**/bins/**"],
    },
    hmr: {
      overlay: true,
    },
  },
});
