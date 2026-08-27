/**
 * Re-applies Webflow's current-page link markers to a raw HTML snippet:
 * <a href="{path}"> gains aria-current="page" and a trailing `w--current`
 * class, exactly as Webflow renders them server-side.
 */
export function markCurrent(html: string, pathname: string): string {
  const path = pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/';
  return html.replace(/<a\b[^>]*>/g, (tag) => {
    if (!tag.includes(`href="${path}"`)) return tag;
    let out = tag.replace(`href="${path}"`, `href="${path}" aria-current="page"`);
    out = out.replace(/class="([^"]*)"/, (_m, cls) => `class="${cls} w--current"`);
    return out;
  });
}
