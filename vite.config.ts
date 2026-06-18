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
        dollaraday: path.resolve(__dirname, "dollaraday.html"),
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    open: "/dollaraday.html",
    watch: {
      ignored: ["**/bins/**"],
    },
    hmr: {
      overlay: true,
    },
  },
});
