import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { workspaceBinsPlugin } from "./vite-plugin-workspace-bins.js";
import { massiveApiPlugin } from "./vite-plugin-massive-api.js";
import { signupNotifyPlugin } from "./vite-plugin-signup-notify.js";

export default defineConfig({
  // Vercel serves from a web root — absolute `/` so SPA rewrites cannot break `./assets/*`.
  // Local + Electron (file://) keep relative `./`.
  base: process.env.VERCEL ? "/" : "./",
  plugins: [
    react(),
    tailwindcss(),
    workspaceBinsPlugin(path.resolve(__dirname, "bins")),
    massiveApiPlugin(),
    signupNotifyPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    modulePreload: {
      // Only preload React for first paint — charts/supabase/icons load on demand.
      resolveDependencies: (_filename, deps) =>
        deps.filter((dep) => dep.includes("react-vendor")),
    },
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        dollaraday: path.resolve(__dirname, "dollaraday.html"),
      },
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          // CRITICAL: keep clsx/tailwind-merge OUT of the charts chunk.
          // Otherwise login downloads ~400KB of recharts just to call cn().
          if (id.includes("clsx") || id.includes("tailwind-merge")) return "react-vendor";
          if (id.includes("recharts") || id.includes("/d3-") || id.includes("\\d3-")) return "charts";
          if (id.includes("@supabase")) return "supabase";
          // Do not force lucide into one mega-chunk — let unused icon trees split with routes.
          if (id.includes("react-dom") || id.includes("/react/") || id.includes("scheduler")) {
            return "react-vendor";
          }
          return undefined;
        },
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
