import { browser } from 'wxt/browser';
import { RECENT_TABS_PERMISSION } from '@/lib/model/recent-tabs';

/** A bounded memory-only cache. Screenshots disappear when the worker stops. */
export class RecentTabPreviews {
  #images = new Map<number, { url: string; image: string }>();
  #timers = new Map<number, ReturnType<typeof setTimeout>>();
  #lastCapture = 0;
  #capturing = false;

  get(tabId: number, url: string): string | undefined {
    const preview = this.#images.get(tabId);
    return preview?.url === url ? preview.image : undefined;
  }

  forget(tabId: number): void { this.#images.delete(tabId); }

  clear(): void {
    for (const timer of this.#timers.values()) clearTimeout(timer);
    this.#timers.clear();
    this.#images.clear();
  }

  schedule(tabId: number, windowId: number): void {
    clearTimeout(this.#timers.get(windowId));
    this.#timers.set(windowId, setTimeout(() => {
      this.#timers.delete(windowId);
      void this.#capture(tabId, windowId).catch(() => undefined);
    }, 600));
  }

  async #capture(tabId: number, windowId: number): Promise<void> {
    if (this.#capturing || Date.now() - this.#lastCapture < 600) return;
    this.#capturing = true;
    try {
      if (!(await browser.permissions.contains(RECENT_TABS_PERMISSION))) return;
      const tab = await browser.tabs.get(tabId);
      if (!tab.active || tab.incognito || !tab.url || !/^https?:/.test(tab.url)) return;
      const window = await browser.windows.get(windowId);
      if (!window.focused) return;
      const overlay: unknown = await browser.tabs.sendMessage(tabId, { type: 'recent-tabs:visible' });
      if (typeof overlay !== 'object' || overlay === null || !('visible' in overlay) || overlay.visible !== false) return;
      this.#lastCapture = Date.now();
      const image = await browser.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 25 });
      const current = await browser.tabs.get(tabId);
      if (!current.active || current.url !== tab.url || !(await browser.permissions.contains(RECENT_TABS_PERMISSION))) return;
      this.#images.delete(tabId);
      this.#images.set(tabId, { url: tab.url, image });
      while (this.#images.size > 10) {
        const oldest = this.#images.keys().next().value;
        if (oldest !== undefined) this.#images.delete(oldest);
      }
    } finally { this.#capturing = false; }
  }
}
