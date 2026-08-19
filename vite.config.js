import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import adapter from "@sveltejs/adapter-static";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    tailwindcss(),
    sveltekit({
      adapter: adapter({
        fallback: "index.html",
      }),
      inspector: {
        toggleButtonPos: "bottom-left",
        showToggleButton: "always",
      },
    }),
  ],
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,

  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    cors: { origin: "*" },
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri` and mock schemas to prevent reloads on save
      ignored: ["**/src-tauri/**", "**/src/lib/mock/**"]
    }
  },
  test: {
    include: ['tests/vitest/**/*.{test,spec}.{js,ts}'],
    globals: true,
    environment: 'jsdom',
  }
}));
