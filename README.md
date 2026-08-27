# tbwlawfirm.com

Astro rebuild of the TBW Law Firm website (personal injury, Orange County),
migrated from Webflow. Built and operated by ZINC; governed by
[Dispatch](https://dispatchvault.com).

## Stack

- **Framework:** Astro (static output, 47 routes)
- **Hosting:** Cloudflare Workers (static assets via `wrangler.jsonc`);
  Workers Builds deploys on every push to `main`
- **Preview:** https://tbwlawfirm.jzaslaw.workers.dev
  (temporary viewer: https://tbwlawfirm-preview.netlify.app via `netlify.toml`)
- **Blog:** git-based content — no database. `src/lib/blog.ts` serves
  `src/data/posts.json` (regenerable from the capture via
  `npm run extract:posts`) plus `src/data/posts-archive.json` (six published
  CMS posts that never appeared on the live blog index; kept unlisted).

## Layout

- `src/pages/` — static pages; `[slug].astro` renders the ten practice areas
  from `src/data/practice-areas.json`; `team/[slug].astro` renders the five
  team pages from `src/data/team.json`; `blog/` renders index + posts.
- `public/` — verbatim Webflow CSS, localized fonts/images/media,
  `js/site.js` (replaces the Webflow runtime), `_redirects` (retired
  Webflow URLs).
- `scripts/port.mjs` — regenerates pages/data from the crawl capture;
  `scripts/download-assets.mjs` localizes assets.

## Working on this site

```bash
npm install
npm run build     # builds to dist/ — must pass before any commit
```

Commit as `ZINC <jzaslaw@zincsolutions.com>`. Every change ships through
Dispatch governance: request → agent → preview → approval → live.
