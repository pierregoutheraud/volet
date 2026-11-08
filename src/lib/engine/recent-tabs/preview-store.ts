import { browser } from 'wxt/browser';

/** At most this many screenshots, across windows: each window shows five recent tabs, and closing one brings up the next. */
const LIMIT = 10;
const INDEX = 'recentTabPreviews';
const imageKey = (tabId: number) => `recentTabPreview:${tabId}`;

interface Entry { tabId: number; url: string }

const isEntry = (value: unknown): value is Entry =>
  typeof value === 'object' && value !== null && 'tabId' in value && typeof value.tabId === 'number' &&
  'url' in value && typeof value.url === 'string';

/**
 * Screenshots in `chrome.storage.session`: Chrome holds it in memory, so they survive the worker stopping, never reach
 * disk or sync, stay out of content scripts' reach, and are gone when Chrome quits or Volet reloads. One key per
 * screenshot plus a small index (oldest first), so forgetting a tab on every navigation only reads the index. Writes
 * run one at a time, so a capture and a forget never overwrite each other.
 */
export class PreviewStore {
  #writes: Promise<unknown> = Promise.resolve();

  /** The screenshot of each tab still on the page it was taken of. */
  async find(tabs: readonly { id: number; url: string }[]): Promise<Map<number, string>> {
    const index = await this.#index();
    const kept = tabs.filter((tab) => index.some((entry) => entry.tabId === tab.id && entry.url === tab.url));
    if (!kept.length) return new Map();
    const images = await browser.storage.session.get(kept.map((tab) => imageKey(tab.id)));
    return new Map(kept.flatMap((tab) => {
      const image: unknown = images[imageKey(tab.id)];
      return typeof image === 'string' ? [[tab.id, image] as const] : [];
    }));
  }

  keep(tabId: number, url: string, image: string): Promise<void> {
    return this.#write(async () => {
      const index = [...(await this.#index()).filter((entry) => entry.tabId !== tabId), { tabId, url }];
      const dropped = index.slice(0, -LIMIT);
      await browser.storage.session.set({ [imageKey(tabId)]: image, [INDEX]: index.slice(-LIMIT) });
      if (dropped.length) await browser.storage.session.remove(dropped.map((entry) => imageKey(entry.tabId)));
    });
  }

  forget(tabId: number): Promise<void> {
    return this.#write(async () => {
      const index = await this.#index();
      if (!index.some((entry) => entry.tabId === tabId)) return;
      await browser.storage.session.set({ [INDEX]: index.filter((entry) => entry.tabId !== tabId) });
      await browser.storage.session.remove(imageKey(tabId));
    });
  }

  clear(): Promise<void> {
    return this.#write(async () => {
      const index = await this.#index();
      if (index.length) await browser.storage.session.remove([INDEX, ...index.map((entry) => imageKey(entry.tabId))]);
    });
  }

  async #index(): Promise<Entry[]> {
    const { [INDEX]: index } = await browser.storage.session.get(INDEX);
    return Array.isArray(index) ? index.filter(isEntry) : [];
  }

  #write(task: () => Promise<void>): Promise<void> {
    const run = this.#writes.then(task);
    this.#writes = run.catch(() => undefined);
    return run;
  }
}
