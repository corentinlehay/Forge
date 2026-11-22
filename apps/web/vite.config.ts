import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// FORGE : PWA local-first pensée pour l'iPhone.
// Le service worker est en mode « prompt » : une mise à jour est proposée,
// jamais appliquée d'office (et jamais pendant une séance, géré côté interface).
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      // L'enregistrement du service worker sera branché avec l'interface (bandeau de mise à jour).
      injectRegister: false,
      manifest: {
        name: 'FORGE',
        short_name: 'FORGE',
        description: 'Musculation, nutrition, poids et récupération, avec un coach IA.',
        lang: 'fr',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
});
