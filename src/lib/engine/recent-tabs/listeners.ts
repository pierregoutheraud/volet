import { browser } from 'wxt/browser';
import type { Engine } from '../engine';
import { loadFaviconImage } from '../favicon';
import { forgetRecentWindow, loadRecentTabs, rememberCreatedTab, rememberRecentTab } from './history';
import { RecentTabPreviews } from './previews';
import { disableRecentTabsListeners, syncRecentTabsRegistration } from './registration';

/** Wire recent-tab history, preview capture and page requests without expanding the main engine. */
export function listenForRecentTabs(engine: Engine): void {
  const previews = new RecentTabPreviews();
  const log = (error: unknown) => console.warn('Recent tabs failed', error);
  const setup = () => engine.enqueue(async () => {
    const enabled = await syncRecentTabsRegistration();
    if (enabled) {
      for (const tab of await browser.tabs.query({ active: true })) {
        if (tab.id !== undefined) previews.schedule(tab.id, tab.windowId);
      }
    }
    return enabled;
  });
  void setup().catch(log);
  browser.permissions.onAdded.addListener(() => { void setup().catch(log); });
  browser.permissions.onRemoved.addListener(() => {
    void engine.enqueue(async () => {
      if (!(await browser.permissions.contains({ origins: ['<all_urls>'] }))) {
        previews.clear();
        await disableRecentTabsListeners();
      }
    }).catch(log);
  });
  browser.tabs.onActivated.addListener(({ tabId, windowId }) => {
    void engine.enqueue(() => rememberRecentTab(tabId, windowId)).catch(log);
    previews.schedule(tabId, windowId);
  });
  browser.tabs.onCreated.addListener((tab) => {
    void engine.enqueue(() => rememberCreatedTab(tab)).catch(log);
  });
  browser.tabs.onUpdated.addListener((tabId, info, tab) => {
    if (info.url) previews.forget(tabId);
    if (tab.active && info.status === 'complete') previews.schedule(tabId, tab.windowId);
  });
  browser.tabs.onRemoved.addListener((tabId) => previews.forget(tabId));
  browser.windows.onRemoved.addListener((windowId) => {
    void engine.enqueue(() => forgetRecentWindow(windowId)).catch(log);
  });
  browser.runtime.onMessage.addListener((message: unknown, sender, respond) => {
    if (typeof message !== 'object' || message === null || !('type' in message)) return;
    let work: Promise<unknown>;
    if (message.type === 'recent-tabs:setup' && !sender.tab) {
      work = setup().then((enabled) => ({ enabled }));
    } else {
      const tab = sender.tab;
      if (tab?.id === undefined || sender.frameId !== 0) return;
      if (message.type === 'recent-tabs:query') {
        work = engine.enqueue(() => loadRecentTabs(tab.windowId)).then(async (tabs) => ({
          tabs: await Promise.all(tabs.map(async (recent) => ({
            ...recent,
            icon: await loadFaviconImage(recent.url),
            preview: previews.get(recent.id, recent.url),
          }))),
        }));
      } else if ((message.type === 'recent-tabs:activate' || message.type === 'recent-tabs:close') && 'tabId' in message &&
        typeof message.tabId === 'number' && Number.isInteger(message.tabId)) {
        const tabId = message.tabId;
        const action = message.type;
        work = engine.enqueue(async () => {
          const target = await browser.tabs.get(tabId);
          if (target.windowId !== tab.windowId) throw new Error('Recent tab belongs to another window');
        }).then(() => engine.run(action === 'recent-tabs:close'
          ? { type: 'closeTab', windowId: tab.windowId, tabId }
          : { type: 'activateTab', tabId })).then(() => ({ ok: true }));
      } else return;
    }
    work.then(respond, (error: unknown) => { log(error); respond({ ok: false }); });
    return true;
  });
}
