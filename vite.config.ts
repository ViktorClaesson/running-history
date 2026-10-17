import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

// BASE_PATH lets the GitHub Pages build live under /<repo>/ while `npm run dev` stays at /.
// https://vite.dev/guide/build#public-base-path
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [svelte()],
  worker: { format: 'es' },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
  },
});
