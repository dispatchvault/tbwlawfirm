# tbwlawfirm.com

Astro build of the TBW Law Firm website (personal injury, Orange County).
Built and operated by ZINC; governed by
[Dispatch](https://dispatchvault.com).

## Stack

- **Framework:** Astro (static output, 47 routes)
- **Hosting:** Cloudflare Pages project `tbwlawfirm-site`, Git-connected:
  every push to `main` builds (`npm run build` → `dist/`) and deploys;
  other branches get preview URLs. `functions/` handles `/api/forms`
  (website forms → D1 + Resend, see `server/forms.js`) and `/media/*`
  (Range support for the hero video).
- **Domain:** DNS stays at GoDaddy (the firm's Microsoft 365 email records
  are untouched): `www` is a CNAME to `tbwlawfirm-site.pages.dev`, and
  `tbwlawfirm.com` is forwarded to `https://www.tbwlawfirm.com` by GoDaddy.
- **Forms:** follow the ZINC forms protocol. Secrets (`RESEND_API_KEY`,
  `FORM_NOTIFY_TO`, `FORM_NOTIFY_FROM`, `FORM_CONFIRM_FROM`) are encrypted
  variables in the Pages dashboard; the D1 schema is in `migrations/`.
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
