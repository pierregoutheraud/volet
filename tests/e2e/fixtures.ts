import path from 'node:path';
import { type BrowserContext, type Page, type Worker, test as base, chromium, expect } from '@playwright/test';

// The end-to-end build (`wxt build --mode e2e`): the production build, but with open shadow roots Playwright can reach.
export const extensionPath = path.resolve(import.meta.dirname, '../../output/chrome-mv3-e2e');

interface Fixtures {
  context: BrowserContext;
  worker: Worker;
  /** The normal browser window the panel manages. */
  windowId: number;
  /** The side panel page, opened in its own popup window and pointed at `windowId`. */
  panel: Page;
}

export const test = base.extend<Fixtures>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: !process.env.HEADED,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    await use(context);
    await context.close();
  },

  worker: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    // Wait until first-run setup has created the bookmark folders.
    await expect
      .poll(() => worker.evaluate(async () => Boolean((await chrome.storage.local.get('root')).root)))
      .toBe(true);
    await use(worker);
  },

  windowId: async ({ worker }, use) => {
    const windowId = await worker.evaluate(async () => {
      const [window] = await chrome.windows.getAll({ windowTypes: ['normal'] });
      return window!.id!;
    });
    await use(windowId);
  },

  panel: async ({ context, worker, windowId }, use) => {
    const opened = context.waitForEvent('page', (page) => page.url().includes('sidepanel.html'));
    await worker.evaluate(async (id) => {
      await chrome.windows.create({ url: `sidepanel.html?windowId=${id}`, type: 'popup', width: 360, height: 800 });
    }, windowId);
    const panel = await opened;
    await panel.waitForLoadState();
    await use(panel);
  },
});

export { expect };

/** Tabs of a window, in strip order, with the group title each sits in. */
export function stripState(worker: Worker, windowId: number) {
  return worker.evaluate(async (id) => {
    const tabs = await chrome.tabs.query({ windowId: id });
    const groups = await chrome.tabGroups.query({ windowId: id });
    return tabs
      .sort((a, b) => a.index - b.index)
      .map((tab) => {
        const group = groups.find((g) => g.id === tab.groupId);
        return {
          id: tab.id!,
          url: tab.url || tab.pendingUrl || '',
          active: tab.active,
          pinned: tab.pinned,
          group: group?.title ?? null,
          collapsed: group?.collapsed ?? null,
        };
      });
  }, windowId);
}

/** The root "Volet" bookmark folder as a plain title tree. */
export function bookmarkTree(worker: Worker) {
  return worker.evaluate(async () => {
    const { root } = (await chrome.storage.local.get('root')) as { root: { rootId: string } };
    const [node] = await chrome.bookmarks.getSubTree(root.rootId);
    type Tree = { title: string; url?: string; children?: Tree[] };
    const strip = (n: chrome.bookmarks.BookmarkTreeNode): Tree =>
      n.url ? { title: n.title, url: n.url } : { title: n.title, children: (n.children ?? []).map(strip) };
    return strip(node!);
  });
}

/** Send a command to the service worker from the panel page, like the UI does. */
export function command(panel: Page, command: Record<string, unknown>) {
  return panel.evaluate(
    (cmd) => chrome.runtime.sendMessage({ type: 'command', command: cmd }),
    command,
  ) as Promise<{ ok: boolean; value?: unknown; error?: string }>;
}
