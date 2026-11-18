import { browser } from 'wxt/browser';
import type { Handlers } from './types';

/** The extension's own pages. */
export const pageHandlers = {
  async openSettings() {
    await browser.runtime.openOptionsPage();
  },

  async openImport() {
    await browser.tabs.create({ url: browser.runtime.getURL('/import.html') });
  },
} satisfies Partial<Handlers>;

/** The welcome page (setup checklist and the basics), opened in a new tab after a first install. */
export async function openWelcome(): Promise<void> {
  await browser.tabs.create({ url: browser.runtime.getURL('/welcome.html') });
}
