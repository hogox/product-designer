import path from "node:path";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// El front corre en :5173 y proxya /api al server delgado que lee el almacén de spec.
// Puerto del server configurable con DASH_PORT (default 8791) para evitar colisiones.
const apiPort = process.env.DASH_PORT ?? "8791";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": `http://localhost:${apiPort}`,
    },
  },
});
