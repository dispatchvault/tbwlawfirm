# tbwlawfirm.com

Astro build of the TBW Law Firm website (personal injury, Orange County).
Built and operated by ZINC; governed by
[Dispatch](https://dispatchvault.com).

## Stack

- **Framework:** Astro (static output, 47 routes)
- **Hosting:** Cloudflare Workers (static assets via `wrangler.jsonc`);
  Workers Builds deploys on every push to `main`
- **Preview:** https://tbwlawfirm.jzaslaw.workers.dev
- **Blog:** git-based content — no database. `src/lib/blog.ts` serves
  `src/data/posts.json` plus `src/data/posts-archive.json` (six published
  posts that never appeared on the blog index; kept unlisted). Edit the JSON
  directly to add or change posts.

## Layout

- `src/pages/` — static pages; `[slug].astro` renders the ten practice areas
  from `src/data/practice-areas.json`; `team/[slug].astro` renders the five
  team pages from `src/data/team.json`; `blog/` renders index + posts.
- `src/styles/` — `site.css` (main stylesheet) and `overrides.css`
  (interaction states driven by `site.js`).
- `src/components/` — shared nav, footer and section snippets (`.html`).
- `public/` — fonts/images/media, `js/site.js` (nav dropdowns, mobile menu,
  accordions, fade-ins, blog filter, video lightbox), `vendor/` (jQuery,
  Swiper and plugins), `_redirects` (301s for retired URLs).

## Working on this site

```bash
npm install
npm run build     # builds to dist/ — must pass before any commit
```

Commit as `ZINC <jzaslaw@zincsolutions.com>`. Every change ships through
Dispatch governance: request → agent → preview → approval → live.
