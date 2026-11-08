import { browser, type Browser } from 'wxt/browser';
import type { Engine } from './engine';
import type { CycleRecentTabs } from './recent-tabs/listeners';
import { panelHasFocus, toggleSidePanel } from './side-panel';
import { pendingPaletteItem } from './storage';

/** Pages an extension can't run scripts in: the palette opens in the side panel instead. */
const NO_SCRIPTS = /^(chrome|chrome-extension|chrome-search|chrome-untrusted|devtools|edge|brave|about|view-source):/i;
const WEB_STORE = /^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)/i;

const PALETTE_SCRIPT = '/palette.js';

/** Keyboard shortcuts declared in the manifest's `commands`; the switcher's are `listenForRecentTabs`'. */
export function listenForShortcuts(engine: Engine, cycleRecentTabs: CycleRecentTabs): void {
  browser.commands.onCommand.addListener((command, tab) => {
    const windowId = tab?.windowId;
    switch (command) {
      case 'toggle-sidebar':
        if (windowId !== undefined) toggleSidePanel(windowId);
        break;
      case 'open-palette':
        openPalette(tab);
        break;
      case 'cycle-recent-tabs-reverse':
      case 'cycle-recent-tabs':
        cycleRecentTabs(tab, command);
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

/**
 * Show the palette where the keyboard is: over the page (the shortcut grants temporary access), or in the side panel
 * when it has focus (the page would get none of its keys, not even Escape) or the page can't host it.
 */
function openPalette(tab: Browser.tabs.Tab | undefined): void {
  if (tab?.windowId === undefined) return;
  const windowId = tab.windowId;
  // The committed URL on purpose, not `tabUrl()`: the script runs in the page showing, not one still loading.
  const url = tab.url ?? '';
  if (tab.id === undefined || !url || NO_SCRIPTS.test(url) || WEB_STORE.test(url)) {
    openInPanel(windowId); // synchronous: sidePanel.open only works during the shortcut's gesture
    return;
  }
  const tabId = tab.id;
  void panelHasFocus(windowId).then((focused) => {
    if (focused) {
      requestPanelPalette(windowId); // the panel is open (it has focus): no need to open it
      return;
    }
    browser.scripting
      .executeScript({ target: { tabId }, files: [PALETTE_SCRIPT] })
      .catch(() => openInPanel(windowId)); // e.g. file:// pages without file access
  });
}

function openInPanel(windowId: number): void {
  browser.sidePanel.open({ windowId }).catch(() => undefined);
  requestPanelPalette(windowId);
}

/** Leave the window's panel a flag to open its palette, now or once it opens (`watchPaletteRequests`). */
function requestPanelPalette(windowId: number): void {
  void pendingPaletteItem.getValue().then((pending) => pendingPaletteItem.setValue({ ...pending, [windowId]: true }));
}
