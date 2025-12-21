import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  server: {
    proxy: {
      '/we': {
        target: 'https://pb4nmtv3tm.re.qweatherapi.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/we/, ''),
      },
    },
  },
  plugins: [react()],
})
