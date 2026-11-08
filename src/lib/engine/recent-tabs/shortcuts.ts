import { browser, type Browser } from 'wxt/browser';
import { recentTabOffset, type RecentTabCommand } from '@/lib/model/recent-tab-shortcut';
import type { Engine } from '../engine';
import { loadRecentTabsState } from './enabled';
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
    // Chrome pages and the Web Store cannot host an overlay: switch where a quick tap would, the last used tab when
    // cycling, the oldest in reverse (wrapping around from the current tab).
    const tabs = await loadRecentTabs(tab.windowId);
    const target = tabs.length > 1 ? tabs.at(offset) : undefined;
    if (target) await engine.run({ type: 'activateTab', tabId: target.id });
  }
}
