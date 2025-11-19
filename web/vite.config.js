// vite.config.js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// Configuración de Vite con Vue + Tailwind 4
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss()
  ]
})
