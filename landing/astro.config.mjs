// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // PLACEHOLDER: the real domain, used for canonical URLs and the sitemap.
  site: 'https://clinicly.pk',
  server: { port: 4321 },
  vite: {
    plugins: [tailwindcss()],
  },
});
