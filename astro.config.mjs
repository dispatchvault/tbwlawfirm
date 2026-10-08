// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.tbwlawfirm.com',
  // static pages; src/pages/api/forms.js is the one on-demand route
  output: 'static',
  adapter: vercel(),
  trailingSlash: 'never',
  // 301s for retired URLs from the previous site
  redirects: {
    // the old sitemap lived at /sitemap.xml; Astro emits sitemap-index.xml
    '/sitemap.xml': '/sitemap-index.xml',
    // old starter/template pages — not carried over
    '/template-pages': '/',
    // /get-started was a dead URL on the old site
    '/get-started': '/contact-us',
    // old category pages were empty template shells; the blog filter handles
    // ?category= deep links client-side (public/js/site.js)
    '/category/recent-news': '/blog?category=Recent+News',
    '/category/case-news': '/blog?category=Case+News',
    '/category/speaking-engagements': '/blog?category=Speaking+Engagements',
    '/category/events-sponsorship': '/blog?category=Events+%26+Sponsorship',
    '/category/education': '/blog?category=Education',
    '/category/videos': '/blog?category=Videos'
  },
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
