import { browser } from 'wxt/browser';
import { canHostOverlay } from '@/lib/model/url';

const PALETTE_SCRIPT = '/palette.js';

/**
 * Add Search to a page's top frame (`palette.ts`). It sets itself up once and waits: the shortcut then toggles it
 * (`palette:toggle`), the panel connects to it (`palette-relay`). Needs site access or the shortcut's activeTab grant.
 */
export async function injectPalette(tabId: number): Promise<void> {
  await browser.scripting.executeScript({ target: { tabId }, files: [PALETTE_SCRIPT] });
}

/**
 * The panel's Search (its button, ⌘K, "/", the shortcut while it has the keyboard): over the window's active page,
 * whose tab it answers, for the panel to send it the keys; or in the panel, where nothing can show over the page.
 * A click in the panel grants no activeTab: without site access, that's the panel too.
 */
export async function openSearch(windowId: number): Promise<{ tabId: number } | { panel: true }> {
  const [tab] = await browser.tabs.query({ active: true, windowId });
  // The committed URL on purpose, not `tabUrl()`: the script runs in the page showing, not one still loading.
  if (tab?.id === undefined || !canHostOverlay(tab.url)) return { panel: true };
  try {
    await injectPalette(tab.id);
    return { tabId: tab.id };
  } catch {
    return { panel: true }; // no site access, a file:// page without file access
  }
}
