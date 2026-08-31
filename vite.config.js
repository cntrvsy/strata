import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";
import { sveltekit } from "@sveltejs/kit/vite";
import adapter from "@sveltejs/adapter-static";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit({
      adapter: adapter({
        fallback: "index.html"
      }),
      alias: {
        "#lib": "./src/lib",
        "#lib/*": "./src/lib/*"
      }
    }),
  ],
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  clearScreen: false,
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
