import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  server: {
    host: "::",
    port: 3000,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          framer: ["framer-motion"],
          supabase: ["@supabase/supabase-js"],
          charts: ["recharts"],
          date: ["date-fns"],
          dnd: ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
          forms: ["react-hook-form", "@hookform/resolvers", "zod"],
          table: ["@tanstack/react-table"],
        },
      },
    },
  },
});
