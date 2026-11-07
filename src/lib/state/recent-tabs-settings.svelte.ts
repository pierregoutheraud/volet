import { browser } from 'wxt/browser';
import { RECENT_TABS_PERMISSION } from '@/lib/model/recent-tabs';

/** Website access is a device-local opt-in, managed by Chrome rather than synced settings. */
export class RecentTabsSettings {
  enabled = $state(false);
  busy = $state(false);
  error = $state('');

  async load(): Promise<void> {
    this.enabled = await browser.permissions.contains(RECENT_TABS_PERMISSION);
  }

  async toggle(): Promise<void> {
    this.busy = true;
    this.error = '';
    try {
      if (this.enabled) {
        await browser.permissions.remove(RECENT_TABS_PERMISSION);
      } else {
        // Request directly in the click handler's gesture, before any other async work.
        const granted = await browser.permissions.request(RECENT_TABS_PERMISSION);
        if (granted) {
          const result: unknown = await browser.runtime.sendMessage({ type: 'recent-tabs:setup' });
          if (typeof result !== 'object' || result === null || !('enabled' in result) || result.enabled !== true) {
            throw new Error('Recent tab switcher setup failed');
          }
        }
      }
      await this.load();
    } catch {
      this.error = 'Could not change tab switching. Try again.';
      await this.load();
    } finally { this.busy = false; }
  }
}
