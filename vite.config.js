import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  // Modifié pour correspondre à la racine de Cloudflare Pages (movibo.pages.dev)
  base: '/', 
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        transmilenio: resolve(__dirname, 'transmilenio.html'),
        pistes: resolve(__dirname, 'pistes.html'),
      },
    },
  },
})
