import { browser, type Browser } from 'wxt/browser';
import { RECENT_TABS_PERMISSION } from '@/lib/model/recent-tabs';
import { hasRecentTabShortcut } from '@/lib/model/recent-tab-shortcut';

/** Site access: granted at install, but users can withhold it in Chrome's details for Volet. The page script needs it. */
export function websiteAccess(): Promise<boolean> {
  return browser.permissions.contains(RECENT_TABS_PERMISSION);
}

/**
 * On while either shortcut is assigned and Chrome grants site access; removing both stops new previews. Also hands
 * back Chrome's commands, read for it, so a press reads them once.
 */
export async function loadRecentTabsState(): Promise<{ enabled: boolean; commands: Browser.commands.Command[] }> {
  const [access, commands] = await Promise.all([websiteAccess(), browser.commands.getAll()]);
  return { enabled: access && hasRecentTabShortcut(commands), commands };
}

export async function recentTabsEnabled(): Promise<boolean> {
  return (await loadRecentTabsState()).enabled;
}
