import { browser, type Browser } from 'wxt/browser';
import { recentTabOffset, type RecentTabCommand } from '@/lib/model/recent-tab-shortcut';
import type { Engine } from '../engine';
import { loadRecentTabsState, recentTabsEnabled } from './enabled';
import { loadRecentTabs } from './history';

/**
 * Native commands supply every cycle step; the page script, on every website, supplies release. Each press reads
 * Chrome's state once: the page may see the modifier go before the press arrives (`PressesInFlight`).
 */
export async function cycleRecentTabs(engine: Engine, tab: Browser.tabs.Tab | undefined, command: RecentTabCommand): Promise<void> {
  if (tab?.id === undefined) return;
  const { enabled, commands } = await loadRecentTabsState();
  if (!enabled) {
    await browser.runtime.openOptionsPage();
    return;
  }
  const offset = recentTabOffset(command);
  const shortcut = commands.find((candidate) => candidate.name === command)?.shortcut;
  if (!shortcut) return;
  try {
    // The page's top frame shows the switcher; its other frames only relay keys.
    await browser.tabs.sendMessage(tab.id, { type: 'recent-tabs:step', shortcut, offset }, { frameId: 0 });
  } catch {
    await switchLikeQuickTap(engine, tab.windowId, offset);
  }
}

/**
 * The Volet panel's button: the switcher over the window's active page, open until a tab is chosen or it's dismissed
 * (there's no modifier to let go of). Resolves to that page's tab, which the panel then sends its keys to. Off, it
 * opens Volet's settings, like the shortcut.
 */
export async function openRecentTabs(engine: Engine, windowId: number): Promise<number | undefined> {
  if (!(await recentTabsEnabled())) {
    await browser.runtime.openOptionsPage();
    return undefined;
  }
  const [tab] = await browser.tabs.query({ active: true, windowId });
  if (tab?.id === undefined) return undefined;
  try {
    await browser.tabs.sendMessage(tab.id, { type: 'recent-tabs:open' }, { frameId: 0 });
    return tab.id;
  } catch {
    await switchLikeQuickTap(engine, windowId, 1);
    return undefined;
  }
}

/**
 * Chrome pages and the Web Store cannot host an overlay: switch where a quick tap would, the last used tab when
 * cycling, the oldest in reverse (wrapping around from the current tab).
 */
async function switchLikeQuickTap(engine: Engine, windowId: number, offset: 1 | -1): Promise<void> {
  const tabs = await loadRecentTabs(windowId);
  const target = tabs.length > 1 ? tabs.at(offset) : undefined;
  if (target) await engine.run({ type: 'activateTab', tabId: target.id });
}
