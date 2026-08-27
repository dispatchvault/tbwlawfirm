/**
 * port.mjs — one-shot porting pipeline: Webflow capture -> Astro source.
 *
 * Reads the rendered-HTML capture of www.tbwlawfirm.com and (re)generates:
 *   - src/components/nav.html / footer.html      (shared chrome snippets)
 *   - src/components/practice/*.html             (shared practice-area sections)
 *   - src/pages/<page>.astro                     (static pages)
 *   - src/data/practice-areas.json               (practice-area template content)
 *   - src/data/team.json                         (team member template content)
 *   - src/data/posts.json + categories.json      (blog stub data — see src/lib/blog.ts)
 *   - assets-manifest.json                       (remote -> local asset map, then downloads)
 *
 * Cleaning applied to every ported fragment:
 *   - Webflow runtime <script> tags, analytics tags and GTM noscripts removed
 *   - data-wf-* / data-w-id attributes removed (w-node-* ids kept: CSS grid uses them)
 *   - Webflow IX2 inline animation styles stripped (opacity/transform/etc.)
 *   - Swiper runtime state de-initialised (clones/state classes/inline styles)
 *   - cdn.prod.website-files.com asset URLs rewritten to local /fonts /images /media
 */
import * as cheerio from 'cheerio';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CAPTURE = process.env.CAPTURE_DIR || '/Users/jimini/Projects/tbwlawfirm-capture';
const PAGES = path.join(CAPTURE, 'pages');

const read = (f) => fs.readFileSync(path.join(PAGES, f), 'utf8');
const write = (rel, content) => {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  console.log('wrote', rel, `(${content.length}b)`);
};

/* ------------------------------------------------------------------ */
/* Asset registry                                                      */
/* ------------------------------------------------------------------ */
const assets = new Map(); // remoteUrl -> local web path
const localNames = new Map(); // localName -> remoteUrl (collision check)

function localizeAsset(rawUrl) {
  const url = rawUrl.trim();
  if (assets.has(url)) return assets.get(url);
  // filename after the site id, possibly %2F-encoded separator
  let file = decodeURIComponent(url.split(/website-files\.com\//)[1] || '');
  file = file.split('/').pop(); // strip site id path
  // drop the 24-hex asset id prefix for readability
  const m = file.match(/^([0-9a-f]{20,32})_(.+)$/i);
  const hash = m ? m[1] : '';
  let name = (m ? m[2] : file)
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9._-]/g, '')
    .replace(/-+/g, '-');
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (ext === 'css') return url; // the shared stylesheet itself; ported separately
  let dir = 'images';
  if (ext === 'otf' || ext === 'ttf' || ext === 'woff' || ext === 'woff2') dir = 'fonts';
  if (ext === 'mp4' || ext === 'webm') dir = 'media';
  // de-dupe: same name from a different remote file gets a short hash prefix
  if (localNames.has(name) && localNames.get(name) !== url) {
    name = `${hash.slice(0, 8)}-${name}`;
  }
  localNames.set(name, url);
  const local = `/${dir}/${name}`;
  assets.set(url, local);
  return local;
}

// parens do appear in a few Webflow asset names ("icn-female%20(1).png");
// every URL context in this codebase (HTML attributes, double-quoted CSS
// url("...")) is quote-delimited, so including them is safe.
const ASSET_RE = /https:\/\/cdn\.prod\.website-files\.com\/[A-Za-z0-9%/._()-]+/g;
const rewriteAssetUrls = (text) => text.replace(ASSET_RE, (u) => localizeAsset(u));

/* ------------------------------------------------------------------ */
/* DOM cleaning                                                        */
/* ------------------------------------------------------------------ */
const ANALYTICS_RE =
  /gtag\(|dataLayer|googletagmanager|fbq\(|fbevents|TiktokAnalytics|ttq\.|clarity|_linkedin|hotjar/;
const WEBFLOW_SHIM_RE = /w-mod-|WebFont|Webflow\s*=/;

const STRIP_STYLE_PROPS = new Set([
  'transform',
  'transform-style',
  'will-change',
  'translate',
  'rotate',
  'scale',
  'opacity'
]);
// classes whose captured display/size/color inline styles came from the Webflow
// interaction runtime and must be reset (behaviour re-implemented in site.js)
const IX_STATE_CLASS_RE =
  /(nav-wrapper|mb-menu-dropdown|acordium|dropdown-list|dropdpwn-toggle-wrapper|dropdown-shadow|footer-acordium|trust-logos-inner)/;

function cleanStyleAttr($el, cls) {
  const style = $el.attr('style');
  if (style == null) return;
  const decls = style
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  const ixReset = IX_STATE_CLASS_RE.test(cls) || /height:\s*0px/.test(style);
  const kept = decls.filter((d) => {
    const prop = d.split(':')[0].trim().toLowerCase();
    if (STRIP_STYLE_PROPS.has(prop)) return false;
    if (ixReset && ['display', 'height', 'width', 'background-color', 'color', 'min-width'].includes(prop))
      return false;
    return true;
  });
  if (kept.length) $el.attr('style', kept.join('; '));
  else $el.removeAttr('style');
}

function cleanDom($) {
  // scripts
  $('script[src]').remove();
  // Webflow CMS repeater templates (percent-encoded markup blobs); the
  // rendered items are already present in the captured DOM
  $('script[type="text/x-wf-template"]').remove();
  $('script:not([src])').each((_, el) => {
    const $el = $(el);
    if (($el.attr('class') || '').includes('w-json')) return; // lightbox data
    const code = $el.html() || '';
    if (ANALYTICS_RE.test(code) || WEBFLOW_SHIM_RE.test(code)) $el.remove();
  });
  $('noscript').remove();

  $('*').each((_, el) => {
    const $el = $(el);
    const attribs = el.attribs || {};
    for (const name of Object.keys(attribs)) {
      if (name.startsWith('data-wf-') || name === 'data-w-id') $el.removeAttr(name);
      else if (attribs[name] && attribs[name].includes('website-files.com')) {
        $el.attr(name, rewriteAssetUrls(attribs[name]));
      }
    }
    const cls = $el.attr('class') || '';
    cleanStyleAttr($el, cls);
  });

  // ---- swiper de-init (runtime re-initialises from pristine markup)
  $('[class*="swiper-slide-duplicate"]').remove();
  $('[class*="swiper"]').each((_, el) => {
    const $el = $(el);
    const cls = ($el.attr('class') || '')
      .split(/\s+/)
      .filter(
        (c) =>
          !/^swiper-(initialized|horizontal|vertical|pointer-events|backface-hidden|autoheight|watch-progress|css-mode|android|ios)$/.test(
            c
          ) && !/^swiper-slide-(active|next|prev|visible|fully-visible|duplicate.*)$/.test(c)
      )
      .join(' ');
    $el.attr('class', cls);
    if (/(^|\s)(swiper-wrapper|swiper-slide)(\s|$)/.test(cls)) $el.removeAttr('style');
  });
  $('.swiper-pagination').empty();

  // ---- dropdown/menu normalisation
  $('.w-dropdown-list, .w-dropdown-toggle').removeClass('w--open');
  $('.w-dropdown-toggle').attr('aria-expanded', 'false');
  $('.mb-menu-dropdown').removeClass('visible');
  // accordions ship closed; the site's own scripts open the first one on load
  // (the capture froze the runtime's post-open state)
  $('[data-click]').removeClass('open');
  $('.acordium-top').each((_, el) => {
    const $el = $(el);
    const style = ($el.attr('style') || '')
      .split(';')
      .map((s) => s.trim())
      .filter((d) => d && !d.toLowerCase().startsWith('border-color'))
      .join('; ');
    if (style) $el.attr('style', style);
    else $el.removeAttr('style');
  });
  return $;
}

const load = (html) => cheerio.load(html);

// body-end custom code (jQuery bindings, swiper inits, stagger <style>) that
// data-driven pages must re-emit; static pages carry theirs inline already.
function collectTail($) {
  const parts = [];
  $('body')
    .children('script, style')
    .each((_, el) => {
      parts.push($.html(el));
    });
  return parts.join('\n');
}

function sharedTail(store, key, tail, from) {
  if (!store[key]) store[key] = { tail, from };
  else if (store[key].tail !== tail)
    console.warn(`  WARN ${from}: body-end scripts differ from ${store[key].from}`);
  return store[key].tail;
}
const tails = {};

/* ------------------------------------------------------------------ */
/* Metadata                                                            */
/* ------------------------------------------------------------------ */
function extractMeta($, file) {
  const title = $('title').first().text();
  const description = $('meta[name="description"]').attr('content') || '';
  const bodyClass = $('body').attr('class') || '';
  // warn on unexpected head extras so nothing silently drops
  const ogImage = $('meta[property="og:image"]').attr('content');
  if (ogImage) console.warn(`  NOTE ${file}: has og:image ${ogImage}`);
  return { title, description, bodyClass };
}

/* ------------------------------------------------------------------ */
/* Astro emission helpers                                              */
/* ------------------------------------------------------------------ */
// escape braces in markup text (not inside script/style) so Astro's template
// compiler does not treat them as expressions
function escapeForAstro(html) {
  return html
    .split(/(<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>)/g)
    .map((chunk, i) =>
      i % 2 === 1 ? chunk : chunk.replace(/\{/g, '&#123;').replace(/\}/g, '&#125;')
    )
    .join('');
}

// make every kept script/style inert to Astro's bundler
function inlineDirectives(html) {
  return html
    .replace(/<script(?![^>]*\bis:inline)([^>]*)>/g, '<script is:inline$1>')
    .replace(/<style(?![^>]*\bis:inline)([^>]*)>/g, '<style is:inline$1>');
}

function stripCurrentMarkers(html) {
  return html.replace(/\s*aria-current="page"/g, '').replace(/\s+w--current/g, '');
}

/* ------------------------------------------------------------------ */
/* Page body -> astro template                                         */
/* ------------------------------------------------------------------ */
function pageTemplate(file) {
  const $ = load(read(file));
  cleanDom($);
  const meta = extractMeta($, file);
  const $nav = $('.nav-fixed').first();
  if ($nav.length) $nav.replaceWith('<nav-placeholder></nav-placeholder>');
  const $footer = $('footer.footer, footer.section').first();
  if ($footer.length) $footer.replaceWith('<footer-placeholder></footer-placeholder>');
  let html = $('body').html() || '';
  html = inlineDirectives(html);
  html = escapeForAstro(html);
  html = html
    .replace('<nav-placeholder></nav-placeholder>', '<Nav />')
    .replace('<footer-placeholder></footer-placeholder>', '<Footer />');
  return { meta, html };
}

function emitStaticPage(file, outRel, opts = {}) {
  const { meta, html } = pageTemplate(file);
  const depth = outRel.split('/').length - 3; // src/pages/x.astro -> 0
  const up = '../'.repeat(depth + 1);
  const astro = `---
import Base from '${up}layouts/Base.astro';
import Nav from '${up}components/Nav.astro';
import Footer from '${up}components/Footer.astro';
---

<Base
  title=${JSON.stringify(meta.title)}
  description=${JSON.stringify(meta.description)}
  bodyClass=${JSON.stringify(meta.bodyClass)}${opts.cmsFilter ? '\n  cmsFilter={true}' : ''}
>
${html.trim()}
</Base>
`;
  write(outRel, astro);
  return meta;
}

/* ------------------------------------------------------------------ */
/* 1. Nav + Footer components                                          */
/* ------------------------------------------------------------------ */
function buildChrome() {
  const $ = load(read('index.html'));
  cleanDom($);
  const nav = stripCurrentMarkers($.html($('.nav-fixed').first()));
  const footer = stripCurrentMarkers($.html($('footer').first()));
  write('src/components/nav.html', nav);
  write('src/components/footer.html', footer);
}

/* ------------------------------------------------------------------ */
/* 2. Practice areas                                                   */
/* ------------------------------------------------------------------ */
const PRACTICE = [
  'personal-injury',
  'car-accident',
  'truck-accident',
  'motorcycle-accident',
  'rideshare-accident',
  'slip-and-fall',
  'brain-injury',
  'spine-injury',
  'amputation',
  'wrongful-death'
];

function buildPracticeAreas() {
  const data = {};
  const shared = {}; // sectionKey -> html (must be identical across pages)
  for (const slug of PRACTICE) {
    const $ = load(read(`${slug}.html`));
    cleanDom($);
    const meta = extractMeta($, slug);
    const sec = (selector) => {
      const $s = $(selector).first();
      return $s.length ? $.html($s) : null;
    };
    const entry = {
      slug,
      title: meta.title,
      description: meta.description,
      bodyClass: meta.bodyClass,
      hero: sec('section.hero'),
      content03: sec('section.content-03'),
      content02: sec('section.content-02'),
      content17: sec('section.conent-17'),
      faq: sec('section.faq-bottom') // only rideshare-accident has one
    };
    // shared sections: testimonials (hidden), success-stories slider
    // NOTE: lazy-loaded images get their `sizes` attribute recomputed by JS at
    // capture time, so comparisons ignore sizes; first page's version is kept.
    const normalize = (html) => (html || '').replace(/\s*sizes="[^"]*"/g, '');
    for (const [key, selector] of [
      ['testimonials', 'div.testimonals__02'],
      ['slider', 'section.slider']
    ]) {
      const html = sec(selector);
      if (!shared[key]) shared[key] = { html, from: slug };
      else if (normalize(shared[key].html) !== normalize(html))
        console.warn(`  WARN ${slug}: section ${key} differs from ${shared[key].from}`);
    }
    // resources: identical apart from the heading text
    const $res = $('section.resources').first();
    const $h = $res.find('h2').first();
    entry.resourcesHeading = $h.text();
    $h.text('__HEADING__');
    const resTpl = $.html($res);
    if (!shared.resources) shared.resources = { html: resTpl, from: slug };
    else if (normalize(shared.resources.html) !== normalize(resTpl))
      console.warn(`  WARN ${slug}: resources section differs from ${shared.resources.from}`);
    sharedTail(tails, 'practice', collectTail($), slug);
    data[slug] = entry;
  }
  write('src/components/practice/testimonials.html', shared.testimonials.html);
  write('src/components/practice/slider.html', shared.slider.html);
  write('src/components/practice/resources.html', shared.resources.html);
  write('src/components/practice/tail.html', tails.practice.tail);
  write('src/data/practice-areas.json', JSON.stringify(data, null, 2));
}

/* ------------------------------------------------------------------ */
/* 3. Team members                                                     */
/* ------------------------------------------------------------------ */
function buildTeam() {
  const files = fs.readdirSync(PAGES).filter((f) => f.startsWith('team_'));
  const data = {};
  for (const f of files) {
    const slug = f.replace(/^team_/, '').replace(/\.html$/, '');
    const $ = load(read(f));
    cleanDom($);
    const meta = extractMeta($, f);
    const $s = $('section.teams-header').first();
    sharedTail(tails, 'team', collectTail($), f);
    data[slug] = {
      slug,
      title: meta.title,
      description: meta.description,
      bodyClass: meta.bodyClass,
      name: $s.find('h1').first().text().trim(),
      html: $.html($s)
    };
  }
  write('src/components/team/tail.html', tails.team.tail);
  write('src/data/team.json', JSON.stringify(data, null, 2));
}

/* ------------------------------------------------------------------ */
/* 4. Blog posts + categories                                          */
/* ------------------------------------------------------------------ */
function buildBlog() {
  const files = fs.readdirSync(PAGES).filter((f) => f.startsWith('blog_'));
  const posts = [];
  for (const f of files) {
    const slug = f.replace(/^blog_/, '').replace(/\.html$/, '');
    const $ = load(read(f));
    cleanDom($);
    const meta = extractMeta($, f);
    const $top = $('section.blog-article-top').first();
    const $content = $('section.blog-content').first();
    const categories = $top
      .find('.blog-category')
      .map((_, el) => $(el).text().trim())
      .get();
    const dateDisplay = $top.find('.date-wrapper > div').first().text().trim();
    const author = $top.find('.date-wrapper > div').last().text().trim();
    const heroImg = $content.find('img.blog-main-image').first();
    const readTime = $content.find('.read-time-wrapper .text-block-6').first().text().trim();
    const $rich = $content.find('.w-richtext').first();
    const parsed = Date.parse(dateDisplay);
    posts.push({
      slug,
      title: $top.find('h2').first().text().trim(),
      metaTitle: meta.title,
      metaDescription: meta.description,
      bodyClass: meta.bodyClass,
      categories,
      dateDisplay,
      date: Number.isNaN(parsed) ? null : new Date(parsed).toISOString().slice(0, 10),
      author,
      readTime,
      heroImage: heroImg.attr('src') || null,
      heroImageSrcset: heroImg.attr('srcset') || null,
      heroImageSizes: heroImg.attr('sizes') || null,
      heroImageAlt: heroImg.attr('alt') || '',
      bodyHtml: $rich.length ? $.html($rich) : $.html($content)
    });
    // share-button embed: identical across posts apart from the per-post URL
    const shareHtml = $.html($content.find('.share-buttons').first()).replace(
      new RegExp(`https://[a-z0-9.-]*(webflow\\.io|tbwlawfirm\\.com)/(post|blog)/${slug}`, 'g'),
      '__POST_URL__'
    );
    if (!buildBlog.shareHtml) {
      buildBlog.shareHtml = shareHtml;
      write('src/components/blog/share-buttons.html', shareHtml);
    } else if (buildBlog.shareHtml !== shareHtml) {
      console.warn(`  WARN ${slug}: share-buttons embed differs from first post`);
    }
    sharedTail(tails, 'blogPost', collectTail($), slug);
  }
  write('src/components/blog/post-tail.html', tails.blogPost.tail);
  posts.sort((a, b) => (a.date && b.date && a.date < b.date ? 1 : -1));
  write('src/data/posts.json', JSON.stringify(posts, null, 2));

  // categories from the blog page's filter checkbox list
  const $b = load(read('blog.html'));
  cleanDom($b);
  write('src/components/blog/tail.html', collectTail($b));

  // listing thumbnails + live listing order (differ from the post hero images)
  $b('.blog-collection-list .blog-item').each((i, el) => {
    const $item = $b(el);
    const slug = ($item.find('a.blog-image-link').first().attr('href') || '').replace('/blog/', '');
    const $img = $item.find('img.cms-image').first();
    const post = posts.find((p) => p.slug === slug);
    if (!post) {
      console.warn(`  WARN blog listing: no captured post for ${slug}`);
      return;
    }
    post.order = i;
    post.thumbImage = $img.attr('src') || post.heroImage;
    post.thumbImageSrcset = $img.attr('srcset') || null;
    post.thumbImageSizes = $img.attr('sizes') || null;
    post.thumbImageAlt = $img.attr('alt') || '';
  });
  for (const p of posts)
    if (p.order == null) console.warn(`  WARN blog listing: post missing from listing: ${p.slug}`);
  write('src/data/posts.json', JSON.stringify(posts, null, 2));

  // blog-filters section (h1 + category checkboxes + search) — the live page
  // embeds a second copy of the nav inside this section; keep its position.
  const $filters = $b('section.blog-filters').first();
  $filters.find('.nav-fixed').replaceWith('<nav-slot></nav-slot>');
  write('src/components/blog/filters.html', stripCurrentMarkers($b.html($filters)));
  write('src/components/blog/newsletter.html', $b.html($b('div.section.newsletter').first()));
  const categories = [];
  $b('.collection-list-2 .checkbox-label, .collection-list-2 label').each((_, el) => {
    const name = $b(el).text().trim();
    if (name && !categories.includes(name)) categories.push(name);
  });
  write('src/data/categories.json', JSON.stringify(categories, null, 2));
}

/* ------------------------------------------------------------------ */
/* 5. Static pages                                                     */
/* ------------------------------------------------------------------ */
const STATIC_PAGES = {
  'index.html': 'src/pages/index.astro',
  'about-tbw-lawfirm.html': 'src/pages/about-tbw-lawfirm.astro',
  'tbw-team.html': 'src/pages/tbw-team.astro',
  'contact-us.html': 'src/pages/contact-us.astro',
  'faqs.html': 'src/pages/faqs.astro',
  'case-referrals.html': 'src/pages/case-referrals.astro',
  'success-stories.html': 'src/pages/success-stories.astro',
  'success-stories--2.html': 'src/pages/success-stories--2.astro',
  'verdicts-and-settlements.html': 'src/pages/verdicts-and-settlements.astro',
  'privacy-policy.html': 'src/pages/privacy-policy.astro',
  'terms-and-conditions.html': 'src/pages/terms-and-conditions.astro'
};

/* ------------------------------------------------------------------ */
/* 6. CSS (verbatim, only asset URLs rewritten)                        */
/* ------------------------------------------------------------------ */
function buildCss() {
  const css = fs.readFileSync(path.join(CAPTURE, 'assets', 'tbwlawfirm.shared.css'), 'utf8');
  write('src/styles/tbwlawfirm.shared.css', rewriteAssetUrls(css));
}

/* ------------------------------------------------------------------ */
/* run                                                                 */
/* ------------------------------------------------------------------ */
const postsOnly = process.argv.includes('--posts-only');
if (postsOnly) {
  buildBlog();
} else {
  buildChrome();
  buildPracticeAreas();
  buildTeam();
  buildBlog();
  for (const [file, out] of Object.entries(STATIC_PAGES)) emitStaticPage(file, out);
  buildCss();
  // favicons referenced from the layout
  localizeAsset(
    'https://cdn.prod.website-files.com/64629c96284b880a2d992ea2/6462c3d0114d58f2b9872eed_ico-ted-wacker.png'
  );
  localizeAsset(
    'https://cdn.prod.website-files.com/64629c96284b880a2d992ea2/6462c3db9866d39c09fcae36_ico-ted-wacker-bg.png'
  );
  const manifest = Object.fromEntries([...assets.entries()].map(([remote, local]) => [local, remote]));
  write('scripts/assets-manifest.json', JSON.stringify(manifest, null, 2));
  console.log(`\n${assets.size} unique assets registered`);
}
