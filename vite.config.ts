import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// PWA via vite-plugin-pwa was removed: o service worker estava mantendo
// um bundle quebrado em cache nos dispositivos dos usuários (tela preta no
// app publicado). O manifest estático em public/manifest.webmanifest e o
// kill-switch em public/sw.js cuidam de instalação na home e limpeza dos
// dispositivos que ainda tinham o SW antigo.
export default defineConfig(() => ({
  base: '/',
  build: {
    outDir: 'dist',
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
