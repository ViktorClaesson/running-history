import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

// BASE_PATH lets the GitHub Pages build live under /<repo>/ while `npm run dev` stays at /.
// https://vite.dev/guide/build#public-base-path
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    svelte(),
    // The service worker and the web app manifest. A service worker is a script the
    // browser runs alongside the page that can answer requests from a cache, which is what
    // lets the app open with no network. https://web.dev/learn/pwa/service-workers
    VitePWA({
      // 'prompt': a new version waits until you choose to reload, rather than swapping
      // code under a running page. See src/lib/ui/components/UpdateBanner.svelte.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Running history',
        short_name: 'Runs',
        description: 'Is my training trending up or down, and did today’s run help?',
        // Relative to `base`, so the same build works at / and at /running-history/.
        start_url: './',
        scope: './',
        display: 'standalone',
        theme_color: '#0d0d0d',
        background_color: '#0d0d0d',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the whole build (the processing worker's bundle included), so the app
        // shell, and everything it needs to read IndexedDB, loads offline.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // The Garmin FIT decoder makes the worker bundle large; still worth precaching.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Never cache API calls: sync must talk to intervals.icu or fail honestly.
        navigateFallbackDenylist: [/^\/api\//],
      },
      devOptions: { enabled: false },
    }),
  ],
  worker: { format: 'es' },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
  },
});
