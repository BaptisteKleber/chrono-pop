import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// En prod, /api/* passe par l'Edge Function Netlify (netlify/edge-functions/api.ts). En local, Vite relaie vers
// l'API Go lancée sur le poste (go run cmd/chrono-pop/main.go, port 8095).
export default defineConfig({
  plugins: [react()],
  build: {
    // Navigateurs un peu anciens (télé, tablettes) : pas de syntaxe trop récente
    target: "es2019",
  },
  server: {
    proxy: {
      "/api": {
        target: process.env.CHRONO_API ?? "http://localhost:8095",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, "/v1/chrono"),
      },
    },
  },
})
