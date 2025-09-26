// vite.config.ts
import path from "path"
import { resolve } from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        serviceWorker: resolve(__dirname, 'src/background/service-worker.ts'),
        content: resolve(__dirname, 'src/content-scripts/content-main.ts') // Add this
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'serviceWorker') {
            return 'serviceWorker.js';
          }
          if (chunkInfo.name === 'content') {
            return 'content-main.js'; // Add this
          }
          return '[name].js';
        },
        chunkFileNames: "[name].js",
        assetFileNames: "[name].[ext]"
      },
      external: ['fsevents']
    },
    minify: 'esbuild',
    target: 'es2020',
    chunkSizeWarningLimit: 2000
  },
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: 'manifest.json', dest: '.' },
        // Remove the content-main.ts copy from here
        { src: 'public/icons/*', dest: '.' },
        { src: 'src/assets/icon-48.png', dest: '.' }
      ]
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
    'global': 'globalThis',
  }
})