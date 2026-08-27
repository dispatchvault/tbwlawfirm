// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.tbwlawfirm.com',
  output: 'static',
  trailingSlash: 'never',
  build: {
    format: 'file'
  },
  vite: {
    build: {
      // keep the ported Webflow stylesheet byte-faithful — pixel parity
      // depends on it and minification buys nothing on a 188KB file
      cssMinify: false,
      // the Webflow capture inlines images up to a few KB either way; don't
      // inline ours so /images/* URLs stay stable
      assetsInlineLimit: 0
    }
  },
  integrations: [sitemap()]
});
