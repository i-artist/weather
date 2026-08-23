import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8182',
        changeOrigin: true,
        secure: false,
        // rewrite: (path) => path.replace(/^\/we/, ''),
      },
      '/windy': {
        target: process.env.WINDY_PROXY_URL || 'http://127.0.0.1:3002',
        changeOrigin: false,
      },
    },
  },
  plugins: [react()],
})
