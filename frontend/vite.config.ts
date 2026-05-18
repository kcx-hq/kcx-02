import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

import { defineConfig } from "vite"
import tailwindcss from "@tailwindcss/vite"

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    chunkSizeWarningLimit: 5000,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  preview: {
    host: true,
    allowedHosts: true,
  },
})
