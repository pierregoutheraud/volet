import { browser, type Browser } from 'wxt/browser';
import type { Engine } from './engine';
import { cycleRecentTabs } from './recent-tabs/shortcuts';
import { toggleSidePanel } from './side-panel';
import { pendingPaletteItem } from './storage';

/** Pages an extension can't run scripts in: the palette opens in the side panel instead. */
const NO_SCRIPTS = /^(chrome|chrome-extension|chrome-search|chrome-untrusted|devtools|edge|brave|about|view-source):/i;
const WEB_STORE = /^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)/i;

const PALETTE_SCRIPT = '/palette.js';

/** Keyboard shortcuts declared in the manifest's `commands`. */
export function listenForShortcuts(engine: Engine): void {
  browser.commands.onCommand.addListener((command, tab) => {
    const windowId = tab?.windowId;
    switch (command) {
      case 'toggle-sidebar':
        if (windowId !== undefined) toggleSidePanel(windowId);
        break;
      case 'open-palette':
        openPalette(tab);
        break;
      case 'cycle-recent-tabs':
      case 'cycle-recent-tabs-previous':
        void cycleRecentTabs(engine, tab, command === 'cycle-recent-tabs' ? 1 : -1)
          .catch((error) => console.warn('Recent tab shortcut failed', error));
        break;
      case 'next-space':
      case 'previous-space':
        if (windowId !== undefined) {
          void engine.run({ type: 'shiftSpace', windowId, offset: command === 'next-space' ? 1 : -1 });
        }
        break;
      case 'toggle-pin':
        if (windowId !== undefined && tab?.id !== undefined) {
          void engine.run({ type: 'togglePin', windowId, tabId: tab.id });
        }
        break;
    }
  });
}

/** Show the palette over the page (the shortcut grants temporary access), or in the side panel. */
function openPalette(tab: Browser.tabs.Tab | undefined): void {
  if (tab?.windowId === undefined) return;
  // The committed URL on purpose, not `tabUrl()`: the script runs in the page showing, not one still loading.
  const url = tab.url ?? '';
  if (tab.id === undefined || !url || NO_SCRIPTS.test(url) || WEB_STORE.test(url)) {
    openInPanel(tab.windowId); // synchronous: sidePanel.open only works during the shortcut's gesture
    return;
  }
  browser.scripting
    .executeScript({ target: { tabId: tab.id }, files: [PALETTE_SCRIPT] })
    .catch(() => openInPanel(tab.windowId)); // e.g. file:// pages without file access
}

function openInPanel(windowId: number): void {
  browser.sidePanel.open({ windowId }).catch(() => undefined);
  void pendingPaletteItem.getValue().then((pending) => pendingPaletteItem.setValue({ ...pending, [windowId]: true }));
}
