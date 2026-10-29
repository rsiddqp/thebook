import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use /thebook/ for GitHub Pages, or ./ for other deployments
  base: process.env.GITHUB_PAGES === 'true' ? '/thebook/' : './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})
