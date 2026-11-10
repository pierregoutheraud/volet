/** Query parameters that only track where a click came from; they don't change the page. */
const TRACKING = /^(utm_|fbclid$|gclid$|mc_eid$|ref_src$)/;

/**
 * Whether two URLs show the same page, loosely: http and https, a leading "www.",
 * a trailing slash, the hash and tracking parameters don't count.
 */
export function sameUrl(a: string, b: string): boolean {
  return normalize(a) === normalize(b);
}

function normalize(url: string): string {
  try {
    const u = new URL(url);
    const params = [...u.searchParams].filter(([key]) => !TRACKING.test(key));
    const query = params.length ? `?${new URLSearchParams(params)}` : '';
    const host = u.host.replace(/^www\./, '');
    const scheme = u.protocol === 'http:' ? 'https:' : u.protocol;
    return `${scheme}//${host}${u.pathname.replace(/\/$/, '')}${query}`;
  } catch {
    return url;
  }
}

/** Pages no extension can run scripts in: Chrome's own, extensions' (Volet's too), the source viewer. */
const NO_SCRIPTS = /^(chrome|chrome-extension|chrome-search|chrome-untrusted|devtools|edge|brave|about|view-source):/i;
/** The Chrome Web Store, which Chrome keeps extensions' scripts out of. */
const WEB_STORE = /^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)/i;

/**
 * Whether Volet can show something over the page at this URL (Search, the tab switcher). Chrome may still refuse it
 * one (a file:// page without file access, a site the user withholds access to).
 */
export function canHostOverlay(url: string | undefined): boolean {
  return Boolean(url) && !NO_SCRIPTS.test(url!) && !WEB_STORE.test(url!);
}

/** Whether the URL is Chrome's New Tab page (a blank tab, as far as the user is concerned). */
export function isNewTabPage(url: string | undefined): boolean {
  return !url || url.startsWith('chrome://newtab') || url.startsWith('chrome://new-tab-page');
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** A short, readable form of a URL for labels: host and path, without the scheme. */
export function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${hostOf(url)}${u.pathname === '/' ? '' : u.pathname}`;
  } catch {
    return url;
  }
}
