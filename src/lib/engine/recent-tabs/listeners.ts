import { browser, type Browser } from 'wxt/browser';
import type { RecentTabCommand } from '@/lib/model/recent-tab-shortcut';
import type { Engine } from '../engine';
import {
  forgetRecentTab, forgetRecentWindow, rememberCreatedTab, rememberRecentTab, replaceRecentTab,
} from './history';
import { listenForRecentTabMessages } from './messages';
import { PressesInFlight } from './presses';
import { RecentTabPreviews } from './previews';
import { attachToOpenPagesOnce, detachFromOpenPages, forgetAttachedPages, syncRecentTabsRegistration } from './registration';
import { cycleRecentTabs } from './shortcuts';

/** What the switcher's shortcuts do, for `listenForShortcuts`. */
export type CycleRecentTabs = (tab: Browser.tabs.Tab | undefined, command: RecentTabCommand) => void;

/**
 * Wire recent-tab history, preview capture and page requests without expanding the main engine. History has its own
 * queue (`history.ts`): only Chrome writes (switching, closing) wait for the engine.
 */
export function listenForRecentTabs(engine: Engine): CycleRecentTabs {
  const previews = new RecentTabPreviews();
  const presses = new PressesInFlight();
  const log = (error: unknown) => console.warn('Recent tabs failed', error);
  /**
   * Follow Chrome's site access: register the page script, and attach to or detach from the pages already open. It
   * doesn't follow the shortcuts, which Chrome reports no change for: without one, the script just stays idle.
   * A fresh grant (`granted`) attaches again; otherwise open pages get the script once per session.
   */
  const refresh = async ({ detach = true, granted = true } = {}) => {
    const ready = await engine.enqueue(syncRecentTabsRegistration);
    if (ready) {
      void attachToOpenPagesOnce({ always: granted }).catch(log);
      for (const tab of await browser.tabs.query({ active: true })) {
        if (tab.id !== undefined) previews.schedule(tab.id, tab.windowId);
      }
    } else {
      previews.clear();
      void forgetAttachedPages().catch(log);
      if (detach) void detachFromOpenPages().catch(log);
    }
    return ready;
  };
  // This runs each time Chrome starts the worker (it stops it after about 30 seconds idle), not only when Volet
  // starts: the pages already have the script then. Unregistering is enough without access: the shortcut and the
  // previews check site access, so a script left on a page from before does nothing.
  void refresh({ detach: false, granted: false }).catch(log);
  browser.permissions.onAdded.addListener(() => { void refresh().catch(log); });
  browser.permissions.onRemoved.addListener(() => { void refresh().catch(log); });
  browser.tabs.onActivated.addListener(({ tabId, windowId }) => {
    rememberRecentTab(tabId, windowId).catch(log);
    previews.schedule(tabId, windowId);
  });
  browser.tabs.onCreated.addListener((tab) => {
    rememberCreatedTab(tab).catch(log);
  });
  browser.tabs.onUpdated.addListener((tabId, info, tab) => {
    if (info.url) previews.forget(tabId);
    // A page loading, or a single-page app moving on without a full load (its URL alone changes): take it again.
    if (tab.active && (info.status === 'complete' || info.url)) previews.schedule(tabId, tab.windowId);
  });
  browser.tabs.onRemoved.addListener((tabId, { windowId, isWindowClosing }) => {
    previews.forget(tabId);
    // A closing window's history goes with it (`windows.onRemoved`).
    if (!isWindowClosing) forgetRecentTab(tabId, windowId).catch(log);
  });
  browser.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
    previews.forget(removedTabId);
    replaceRecentTab(addedTabId, removedTabId).catch(log);
  });
  browser.windows.onRemoved.addListener((windowId) => {
    forgetRecentWindow(windowId).catch(log);
  });
  listenForRecentTabMessages({ engine, previews, presses, setup: () => refresh(), log });
  return (tab, command) => {
    const press = cycleRecentTabs(engine, tab, command);
    // Right away, before the press reads anything: the page's question about it (`recent-tabs:settle`) may follow soon.
    if (tab?.id !== undefined) presses.track(tab.id, press);
    void press.catch((error: unknown) => console.warn('Recent tab shortcut failed', error));
  };
}
