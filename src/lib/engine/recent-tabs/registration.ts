import { browser } from 'wxt/browser';
import { RECENT_TABS_PERMISSION } from '@/lib/model/recent-tabs';

const SCRIPT_ID = 'recent-tab-switcher';
const SCRIPT_FILE = '/recent-tabs.js';

/** Register before navigation and attach to existing pages when the user opts in. */
export async function syncRecentTabsRegistration(): Promise<boolean> {
  const enabled = await browser.permissions.contains(RECENT_TABS_PERMISSION);
  const registered = await browser.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
  if (!enabled) {
    if (registered.length) await browser.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
    return false;
  }
  if (!registered.length) {
    await browser.scripting.registerContentScripts([{
      id: SCRIPT_ID,
      js: [SCRIPT_FILE],
      matches: ['http://*/*', 'https://*/*'],
      runAt: 'document_start',
    }]);
  }
  const tabs = await browser.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  await Promise.allSettled(tabs.flatMap((tab) => tab.id === undefined ? [] : [
    browser.scripting.executeScript({ target: { tabId: tab.id }, files: [SCRIPT_FILE] }),
  ]));
  return true;
}

/** Remove already loaded listeners too; unregistering alone only affects future pages. */
export async function disableRecentTabsListeners(): Promise<void> {
  await syncRecentTabsRegistration();
  const tabs = await browser.tabs.query({});
  await Promise.allSettled(tabs.flatMap((tab) => tab.id === undefined ? [] : [
    browser.tabs.sendMessage(tab.id, { type: 'recent-tabs:disable' }),
  ]));
}
