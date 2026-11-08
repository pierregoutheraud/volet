import { browser, type Browser } from 'wxt/browser';
import { storage } from 'wxt/utils/storage';
import { websiteAccess } from './enabled';

const SCRIPT_ID = 'recent-tab-switcher';
const SCRIPT_FILE = '/recent-tabs.js';
/** The switcher's overlay, added to a page's top frame on the first press there (`recent-tabs:overlay`). */
export const OVERLAY_FILE = '/recent-tabs-overlay.js';
const PAGES = ['http://*/*', 'https://*/*'];

/**
 * In every frame, before the page's own scripts: a frame with focus (an editor's, an embed's) relays the keys to the
 * top frame. `matchOriginAsFallback` covers frames with no address of their own (about:blank, where editors often
 * take their typing), by their parent's origin.
 */
const SCRIPT = {
  id: SCRIPT_ID,
  js: [SCRIPT_FILE],
  matches: PAGES,
  runAt: 'document_start',
  allFrames: true,
  matchOriginAsFallback: true,
} satisfies Browser.scripting.RegisteredContentScript;

/** Whether Chrome's registration still has every option `SCRIPT` sets: Chrome keeps one registered across updates. */
const isCurrent = (registered: Browser.scripting.RegisteredContentScript) =>
  registered.runAt === SCRIPT.runAt && registered.allFrames === SCRIPT.allFrames &&
  registered.matchOriginAsFallback === SCRIPT.matchOriginAsFallback &&
  registered.js?.join() === SCRIPT.js.join() && registered.matches?.join() === SCRIPT.matches.join();

/** Register before navigation while Chrome grants site access, unregister otherwise. Returns whether it's registered. */
export async function syncRecentTabsRegistration(): Promise<boolean> {
  const access = await websiteAccess();
  const [registered] = await browser.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
  if (!access) {
    if (registered) await browser.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
    return false;
  }
  if (!registered) await browser.scripting.registerContentScripts([SCRIPT]);
  else if (!isCurrent(registered)) await browser.scripting.updateContentScripts([SCRIPT]);
  return true;
}

/**
 * Whether open pages were given the script since Volet started. Chrome clears session storage on install, update,
 * reload, disable and restart: exactly when pages may be open without it (Chrome adds a registered script to pages
 * loaded after it, never to those already open). A worker that merely woke up again finds it set.
 */
const attachedItem = storage.defineItem<boolean>('session:recentTabsAttached', { fallback: false });

/**
 * Attach to open pages, unless they were already (`always` for a fresh grant of site access). Keep it out of the
 * engine queue: it waits on every page, and one that never finishes loading would hold every command.
 */
export async function attachToOpenPagesOnce({ always = false } = {}): Promise<void> {
  if (!always && (await attachedItem.getValue())) return;
  await attachedItem.setValue(true);
  await attachToOpenPages();
}

/** After site access is withdrawn, the next grant has every open page to attach to again. */
export async function forgetAttachedPages(): Promise<void> {
  await attachedItem.removeValue();
}

/**
 * Attach to pages that were open before the script was registered. Injecting immediately, like the registered
 * `document_start` script, doesn't wait for a loading page to become idle.
 */
async function attachToOpenPages(): Promise<void> {
  const tabs = await browser.tabs.query({ url: PAGES });
  await Promise.allSettled(tabs.flatMap((tab) => tab.id === undefined ? [] : [
    browser.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: [SCRIPT_FILE], injectImmediately: true }),
  ]));
}

/** Remove already loaded listeners too; unregistering only affects future pages. Out of the queue, like attaching. */
export async function detachFromOpenPages(): Promise<void> {
  const tabs = await browser.tabs.query({});
  await Promise.allSettled(tabs.flatMap((tab) => tab.id === undefined ? [] : [
    browser.tabs.sendMessage(tab.id, { type: 'recent-tabs:disable' }),
  ]));
}
