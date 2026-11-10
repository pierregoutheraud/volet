import { browser, type Browser } from 'wxt/browser';
import { PAGE_COPY_URL, PANEL_COPY_URL, wasCopied } from '@/lib/model/copy-url';
import { canHostOverlay } from '@/lib/model/url';
import { activeSpaceOf, hueOf, loadContext } from './context';
import { tabUrl } from './snapshot';

const SCRIPT = '/copy-url.js';

/**
 * The copy shortcut: the active tab's link to the clipboard, written where the keyboard is (`model/copy-url.ts`): the
 * Volet panel when it has it, else the page, which says so over itself, tinted like the active Volet. Nothing on
 * Chrome's own pages, where no script runs (the address bar copies it there).
 */
export async function copyUrl(tab: Browser.tabs.Tab | undefined): Promise<void> {
  if (tab?.id === undefined || tab.windowId === undefined) return;
  const url = tabUrl(tab);
  if (!url) return;
  if (await copyInPanel(tab.windowId, url)) return;
  // The committed URL on purpose: the script runs in the page showing, not one still loading.
  if (!canHostOverlay(tab.url)) return;
  const ctx = await loadContext(tab.windowId);
  // The shortcut's activeTab grant covers the page, with or without site access.
  await browser.scripting.executeScript({ target: { tabId: tab.id }, files: [SCRIPT] });
  await browser.tabs.sendMessage(tab.id, { type: PAGE_COPY_URL, url, hue: hueOf(ctx, activeSpaceOf(ctx)) }, { frameId: 0 });
}

/** Only a panel that has the keyboard answers, once it has copied: no answer (or no panel) means no. */
async function copyInPanel(windowId: number, url: string): Promise<boolean> {
  try {
    return wasCopied(await browser.runtime.sendMessage({ type: PANEL_COPY_URL, windowId, url }));
  } catch {
    return false;
  }
}
