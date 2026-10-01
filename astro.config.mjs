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
      // keep site.css readable in the build; minification buys little here
      cssMinify: false,
      // don't inline small images so /images/* URLs stay stable
      assetsInlineLimit: 0
    }
  },
  integrations: [sitemap()]
});
