import { browser, type Browser } from 'wxt/browser';
import type { Engine } from '../engine';
import { loadRecentTabs } from './history';
import { RECENT_TABS_PERMISSION } from '@/lib/model/recent-tabs';

/** Native commands supply every cycle step; the preloaded page listener supplies release. */
export async function cycleRecentTabs(engine: Engine, tab: Browser.tabs.Tab | undefined, offset: 1 | -1): Promise<void> {
  if (tab?.id === undefined) return;
  if (!(await browser.permissions.contains(RECENT_TABS_PERMISSION))) {
    await browser.runtime.openOptionsPage();
    return;
  }
  const commands = await browser.commands.getAll();
  const commandName = offset === 1 ? 'cycle-recent-tabs' : 'cycle-recent-tabs-previous';
  const shortcut = commands.find((command) => command.name === commandName)?.shortcut;
  if (!shortcut) return;
  try {
    await browser.tabs.sendMessage(tab.id, { type: 'recent-tabs:step', shortcut, offset });
  } catch {
    // Chrome pages and the Web Store cannot host an overlay: either direction starts with the previous tab.
    const target = await engine.enqueue(async () => (await loadRecentTabs(tab.windowId))[1]);
    if (target) await engine.run({ type: 'activateTab', tabId: target.id });
  }
}
