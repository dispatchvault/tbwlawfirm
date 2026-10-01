/**
 * Marks current-page links in a raw HTML snippet: <a href="{path}"> gains
 * aria-current="page" and a trailing `is-current` class.
 */
export function markCurrent(html: string, pathname: string): string {
  const path = pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/';
  return html.replace(/<a\b[^>]*>/g, (tag) => {
    if (!tag.includes(`href="${path}"`)) return tag;
    let out = tag.replace(`href="${path}"`, `href="${path}" aria-current="page"`);
    out = out.replace(/class="([^"]*)"/, (_m, cls) => `class="${cls} is-current"`);
    return out;
  });
}
