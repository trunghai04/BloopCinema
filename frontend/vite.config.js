import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    /** Truy cập từ điện thoại trong LAN: http://<IP-máy>:5173 */
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false,
        ws: false
      },
      "/uploads": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false,
        ws: false
      }
    }
  }
});
