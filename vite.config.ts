// File: vite.config.ts
import path from "path";
import { resolve } from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup.html"),
        serviceWorker: resolve(__dirname, "src/background/service-worker.ts"),
        claudeContent: resolve(
          __dirname,
          "src/content-scripts/claude-content.ts"
        ),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === "serviceWorker") {
            return "serviceWorker.js";
          }
          if (chunkInfo.name === "claudeContent") {
            return "claude-content.js";
          }
          return "[name].js";
        },
        chunkFileNames: "[name].js",
        assetFileNames: "[name].[ext]",
      },
    },
    minify: "esbuild",
    target: "es2020",
  },
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: "manifest.json", dest: "." },
        { src: "public/icons/*", dest: "." },
      ],
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(
      process.env.NODE_ENV || "production"
    ),
    global: "globalThis",
  },
});
