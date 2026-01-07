import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  // Note: Vite automatically exposes environment variables prefixed with VITE_
  // No need to manually define them
  define: {
    global: 'globalThis' // Required for mqtt.js browser compatibility
  },
  server: {
    port: parseInt(process.env.VITE_PORT || '5173', 10),
    proxy: {
      // Proxy API requests to local Express server during development
      '/api': {
        target: `http://localhost:${process.env.API_PORT || '3001'}`,
        changeOrigin: true
      }
    }
  }
})
