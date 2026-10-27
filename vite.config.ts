import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { rolldownOptions: { input: {
    main: fileURLToPath(new URL("./index.html", import.meta.url)),
    swagger: fileURLToPath(new URL("./swagger.html", import.meta.url)),
  } } },
  server: { host: "127.0.0.1", port: 5174, strictPort: true, proxy: { "/api/qa": "http://127.0.0.1:5180" } },
});
