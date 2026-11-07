import { browser } from 'wxt/browser';

/** Read Chrome's local favicon cache from the extension origin, returning an inline PNG for page overlays. */
export async function loadFaviconImage(pageUrl: string): Promise<string | undefined> {
  if (!/^https?:\/\//i.test(pageUrl)) return undefined;
  try {
    // Chrome's virtual cache endpoint is not a bundled asset in WXT's typed paths.
    const url = new URL(`chrome-extension://${browser.runtime.id}/_favicon/`);
    url.searchParams.set('pageUrl', pageUrl);
    url.searchParams.set('size', '64');
    const response = await fetch(url);
    if (!response.ok) return undefined;
    const bytes = new Uint8Array(await response.arrayBuffer());
    // Chrome's virtual response omits Content-Type, so validate the PNG signature instead.
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (bytes.length < signature.length || bytes.length > 64 * 1024 ||
      signature.some((byte, index) => bytes[index] !== byte)) return undefined;
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return `data:image/png;base64,${btoa(binary)}`;
  } catch {
    return undefined;
  }
}
