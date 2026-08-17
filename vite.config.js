import { copyFileSync, existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'

function githubPagesSpaFallback() {
  return {
    name: 'github-pages-spa-fallback',
    apply: 'build',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist')
      const indexHtml = resolve(distDir, 'index.html')
      if (!existsSync(indexHtml)) return
      copyFileSync(indexHtml, resolve(distDir, '404.html'))
      writeFileSync(resolve(distDir, '.nojekyll'), '')
    },
  }
}

export default defineConfig({
  plugins: [react(), tsconfigPaths(), tailwindcss(), githubPagesSpaFallback()],
  // Relative assets for local dev, preview, and Capacitor.
  // GitHub Pages overrides this via `npm run build:pages` (--base /6d-watch/).
  base: './',
})
