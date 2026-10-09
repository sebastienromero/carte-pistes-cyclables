import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  // Si vous hébergez sur GitHub Pages, gardez cette ligne. Sinon, vous pouvez la supprimer.
  base: '/carte-pistes-cyclables/', 
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
