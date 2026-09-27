import { defineConfig } from 'astro/config';

export default defineConfig({
  // `||`, not `??`: an unset GitHub Actions repo variable arrives as the empty
  // string, not undefined, so `??` would never fall back and `site: ''` breaks the build.
  site: process.env.SITE_URL || 'https://strokesandverses.github.io',
  base: process.env.BASE_PATH || '/',
});
