/**
 * Shadow roots Volet adds to web pages are closed, so the page's own scripts can't read what they show (your tabs'
 * titles, addresses and screenshots). Only the end-to-end build (`wxt build --mode e2e`) opens them, for Playwright,
 * which can't reach into a closed root.
 */
export function shadowMode(mode: string): ShadowRootMode {
  return mode === 'e2e' ? 'open' : 'closed';
}
