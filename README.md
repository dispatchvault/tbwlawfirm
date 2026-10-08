# tbwlawfirm.com

Astro build of the TBW Law Firm website (personal injury, Orange County).
Built and operated by ZINC; governed by
[Dispatch](https://dispatchvault.com).

## Stack

- **Framework:** Astro (static output, 47 routes)
- **Hosting:** Vercel, project `tbwlawfirm` in ZINC's Pro team. Git-connected:
  every push to `main` deploys to production; every other branch gets a
  preview URL. Pages are static; `src/pages/api/forms.js` is the one
  on-demand route (a Vercel function, see `server/forms.js`). Redirects for
  retired URLs live in `astro.config.mjs`.
- **Domain:** DNS stays at GoDaddy (the firm's Microsoft 365 email records
  are untouched): an A record for `tbwlawfirm.com` and a CNAME for `www`,
  both pointing at Vercel; Vercel redirects the bare domain to www.
- **Forms:** ZINC forms protocol, "Standard" tier: each lead is emailed
  through Resend before the visitor sees success; any failure shows the
  error with the firm's phone number. No database. `RESEND_API_KEY`,
  `FORM_NOTIFY_TO`, `FORM_NOTIFY_FROM` and `FORM_CONFIRM_FROM` are Vercel
  environment variables (this repo is public).
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
