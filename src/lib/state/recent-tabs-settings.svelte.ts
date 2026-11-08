import { browser } from 'wxt/browser';
import { RECENT_TABS_PERMISSION } from '@/lib/model/recent-tabs';

/**
 * The switcher is on while one of its shortcuts is assigned. Chrome grants it site access at install, but users can
 * withhold it in Chrome's details for Volet: the card then offers to allow it again.
 */
export class RecentTabsSettings {
  access = $state(true);
  busy = $state(false);
  error = $state('');

  async load(): Promise<void> {
    this.access = await browser.permissions.contains(RECENT_TABS_PERMISSION);
  }

  async allow(): Promise<void> {
    this.busy = true;
    this.error = '';
    try {
      // Ask Chrome directly in the click handler's gesture, before any other async work.
      if (!(await browser.permissions.request(RECENT_TABS_PERMISSION))) return;
      const result: unknown = await browser.runtime.sendMessage({ type: 'recent-tabs:setup' });
      if (typeof result !== 'object' || result === null || !('ready' in result) || result.ready !== true) {
        throw new Error('Recent tab switcher setup failed');
      }
    } catch {
      this.error = 'Could not allow website access. Try again.';
    } finally {
      await this.load().catch(() => undefined);
      this.busy = false;
    }
  }
}
