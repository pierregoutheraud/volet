import { browser, type Browser } from 'wxt/browser';
import { storage } from 'wxt/utils/storage';
import { orderRecentTabs, type RecentTab } from '@/lib/model/recent-tabs';
import { SerialQueue } from '../retry';
import { tabUrl } from '../snapshot';

const recentTabsItem = storage.defineItem<Record<string, number[]>>('session:recentTabs', { fallback: {} });

/**
 * Every read and write of the history, one after another. Its own queue, not the engine's: the switcher reads it on
 * every press, and must not wait behind a long command (an import, edits retried while a tab is dragged).
 */
const queue = new SerialQueue();

async function remember(tabId: number, windowId: number, activeTabId?: number): Promise<void> {
  const history = await recentTabsItem.getValue();
  const recent = history[windowId] ?? [];
  const order = [tabId, ...(activeTabId === undefined ? [] : [activeTabId]), ...recent];
  await recentTabsItem.setValue({ ...history, [windowId]: [...new Set(order)].slice(0, 5) });
}

/** Record a visit. */
export function rememberRecentTab(tabId: number, windowId: number): Promise<void> {
  return queue.run(() => remember(tabId, windowId));
}

/** Newly opened background tabs take precedence over previous visits, without activating them. */
export function rememberCreatedTab(tab: Browser.tabs.Tab): Promise<void> {
  return queue.run(async () => {
    if (tab.id === undefined) return;
    // Keep the still-active page next, for quick toggling.
    const [active] = tab.active ? [tab] : await browser.tabs.query({ windowId: tab.windowId, active: true });
    await remember(tab.id, tab.windowId, active?.id);
  });
}

/** Load only live tabs in this window, with Chrome recency as the startup fallback. */
export function loadRecentTabs(windowId: number): Promise<RecentTab[]> {
  return queue.run(async () => {
    const tabs = await browser.tabs.query({ windowId });
    const history = await recentTabsItem.getValue();
    return orderRecentTabs(tabs, history[windowId] ?? []).flatMap((tab) => tab.id === undefined ? [] : [{
      id: tab.id,
      title: tab.title || 'New tab',
      url: tabUrl(tab) ?? '',
    }]);
  });
}

/** Drop window history when Chrome closes the window. */
export function forgetRecentWindow(windowId: number): Promise<void> {
  return queue.run(async () => {
    const { [windowId]: _removed, ...rest } = await recentTabsItem.getValue();
    await recentTabsItem.setValue(rest);
  });
}

/** Drop a closed tab, so it stops taking one of the window's few slots. */
export function forgetRecentTab(tabId: number, windowId: number): Promise<void> {
  return queue.run(async () => {
    const history = await recentTabsItem.getValue();
    const recent = history[windowId];
    if (!recent?.includes(tabId)) return;
    await recentTabsItem.setValue({ ...history, [windowId]: recent.filter((id) => id !== tabId) });
  });
}

/** Chrome swapped a tab for another (a prerendered page): it keeps its place. */
export function replaceRecentTab(addedTabId: number, removedTabId: number): Promise<void> {
  return queue.run(async () => {
    const history = await recentTabsItem.getValue();
    if (!Object.values(history).some((recent) => recent.includes(removedTabId))) return;
    await recentTabsItem.setValue(Object.fromEntries(Object.entries(history).map(([windowId, recent]) =>
      [windowId, [...new Set(recent.map((id) => (id === removedTabId ? addedTabId : id)))]])));
  });
}
