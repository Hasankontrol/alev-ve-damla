import { defineConfig } from 'vite';

export default defineConfig({
  // Goreli yol: hem GitHub Pages alt dizininde (kullanici.github.io/repo/)
  // hem de dogrudan dosyadan acildiginda calisir. Repo adi sabitlenmez.
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
    chunkSizeWarningLimit: 900,   // three.js tek basina ~700 kB
  },
  server: {
    port: 5173,
    open: false,
  },
});
