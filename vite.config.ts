import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => ({
  plugins: [
    react(),
    tailwindcss(),
    // [P-201] El juego se instala desde el navegador en Android y en iOS. El
    // manifiesto canónico es `public/manifest.json`, enlazado desde index.html:
    // con `manifest: false` el plugin no inyecta un segundo <link rel="manifest">,
    // porque el navegador solo respeta el primero y dos manifiestos significan
    // nombre e iconos equivocados en la pantalla de inicio.
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      workbox: {
        // [P-203] Se precacha el armazón —código, estilos, iconos—, no el agua.
        // El juego genera sus mallas y sus colores por código (`R-2xx`), así que
        // el armazón ES el juego: no hay megas de textura que justifiquen otra
        // política.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
      },
      includeAssets: [
        'manifest.json',
        'icon.svg',
        'icon-192.png',
        'icon-512.png',
        'icon-maskable-192.png',
        'icon-maskable-512.png',
        'apple-touch-icon.png',
      ],
    }),
  ],
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  build: { target: 'es2022' },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
}));
