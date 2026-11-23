import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

/** Commit court de la version construite : fourni par Cloudflare (Workers Builds), sinon lu dans git. */
function buildVersion(): string {
  const fromCi = process.env.WORKERS_CI_COMMIT_SHA;
  if (fromCi) return fromCi.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'locale';
  }
}

function buildDay(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// FORGE : PWA local-first pensée pour l'iPhone.
// Le service worker est en mode « prompt » : une mise à jour est proposée,
// jamais appliquée d'office (bandeau « Mettre à jour » dans l'app).
export default defineConfig({
  define: {
    __FORGE_VERSION__: JSON.stringify(buildVersion()),
    __FORGE_BUILT_AT__: JSON.stringify(buildDay()),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/apple-touch-icon.png', 'icons/icon.svg'],
      manifest: {
        id: '/',
        name: 'FORGE',
        short_name: 'FORGE',
        description: 'Musculation, nutrition, poids et récupération, avec un coach IA.',
        lang: 'fr',
        dir: 'ltr',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json,webmanifest,wasm}'],
        // Le moteur du scanner (≈ 1 Mo) et la table Ciqual sont mis en cache pour marcher hors ligne.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
