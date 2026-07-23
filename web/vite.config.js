import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Default ("/") — the deployed frontend is served from its own domain
  // root (Cloud Run, see web/Dockerfile), not a GCS object subpath anymore,
  // so absolute asset references resolve correctly.
});
