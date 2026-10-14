import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // edge functions (Deno) importam do esm.sh; no teste usa o pacote do npm
      "https://esm.sh/@supabase/supabase-js@2.76.0": "@supabase/supabase-js",
      "https://esm.sh/@supabase/supabase-js@2": "@supabase/supabase-js",
      "https://deno.land/std@0.168.0/http/server.ts": path.resolve(__dirname, "./src/test/deno-serve-shim.ts"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
