import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'https://weather.sh-newenergy.com',
        changeOrigin: true,
        secure: false,
        // rewrite: (path) => path.replace(/^\/we/, ''),
      },
    },
  },
  plugins: [react()],
})
