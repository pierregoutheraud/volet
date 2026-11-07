import { browser, type Browser } from 'wxt/browser';
import { storage } from 'wxt/utils/storage';
import { orderRecentTabs, type RecentTab } from '@/lib/model/recent-tabs';
import { tabUrl } from '../snapshot';

const recentTabsItem = storage.defineItem<Record<string, number[]>>('session:recentTabs', { fallback: {} });

/** Record a visit or new tab, keeping the still-active page next for quick toggling. Caller uses the engine queue. */
export async function rememberRecentTab(tabId: number, windowId: number, activeTabId?: number): Promise<void> {
  const history = await recentTabsItem.getValue();
  const recent = history[windowId] ?? [];
  const order = [tabId, ...(activeTabId === undefined ? [] : [activeTabId]), ...recent];
  await recentTabsItem.setValue({ ...history, [windowId]: [...new Set(order)].slice(0, 5) });
}

/** Newly opened background tabs take precedence over previous visits, without activating them. */
export async function rememberCreatedTab(tab: Browser.tabs.Tab): Promise<void> {
  if (tab.id === undefined) return;
  const [active] = tab.active ? [tab] : await browser.tabs.query({ windowId: tab.windowId, active: true });
  await rememberRecentTab(tab.id, tab.windowId, active?.id);
}

/** Load only live tabs in this window, with Chrome recency as the startup fallback. */
export async function loadRecentTabs(windowId: number): Promise<RecentTab[]> {
  const tabs = await browser.tabs.query({ windowId });
  const history = await recentTabsItem.getValue();
  return orderRecentTabs(tabs, history[windowId] ?? []).flatMap((tab) => tab.id === undefined ? [] : [{
    id: tab.id,
    title: tab.title || 'New tab',
    url: tabUrl(tab) ?? '',
  }]);
}

/** Drop window history when Chrome closes the window. Caller uses the engine queue. */
export async function forgetRecentWindow(windowId: number): Promise<void> {
  const { [windowId]: _removed, ...rest } = await recentTabsItem.getValue();
  await recentTabsItem.setValue(rest);
}
