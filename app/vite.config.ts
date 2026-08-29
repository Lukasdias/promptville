import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react({ reactCompiler: true }), tailwindcss()],
  server: {
    proxy: {
      "/api": "http://localhost:4100",
    },
    allowedHosts: [".ngrok-free.app", ".ngrok.app", ".ngrok.io"],
  },
});