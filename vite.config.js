import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";
import { sveltekit } from "@sveltejs/kit/vite";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit(),
  ],
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  clearScreen: false,
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/typescript/') || id.includes('node_modules/ts-morph/')) {
            return 'ts-morph';
          }
          if (id.includes('node_modules/@xyflow/') || id.includes('node_modules/@dagrejs/') || id.includes('node_modules/d3-')) {
            return 'xyflow';
          }
          if (id.includes('node_modules/elkjs/')) {
            return 'elkjs';
          }
          if (id.includes('node_modules/codemirror/') || id.includes('node_modules/@codemirror/')) {
            return 'codemirror';
          }
        }
      }
    }
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    cors: { origin: "*" },
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: {
      // tell Vite to ignore watching `src-tauri` and mock schemas to prevent reloads on save
      ignored: ["**/src-tauri/**", "**/src/lib/mock/**"]
    }
  },
  test: {
    include: ['tests/vitest/**/*.{test,spec}.{js,ts}'],
    globals: true,
    environment: 'jsdom',
  }
});
