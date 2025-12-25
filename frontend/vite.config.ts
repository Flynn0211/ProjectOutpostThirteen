import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/sui-testnet': {
        target: 'https://fullnode.testnet.sui.io',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/sui-testnet/, ''),
      },
      '/sui-mainnet': {
        target: 'https://fullnode.mainnet.sui.io',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/sui-mainnet/, ''),
      },
    },
  },
})