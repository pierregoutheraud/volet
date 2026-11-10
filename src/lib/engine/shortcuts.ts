import { browser, type Browser } from 'wxt/browser';
import { PALETTE_TOGGLE } from '@/lib/model/palette-relay';
import { canHostOverlay } from '@/lib/model/url';
import { copyUrl } from './copy-url';
import type { Engine } from './engine';
import { injectPalette } from './palette/open';
import type { CycleRecentTabs } from './recent-tabs/listeners';
import { isPanelOpen, panelHasFocus, toggleSidePanel } from './side-panel';
import { pendingPaletteItem } from './storage';

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
      case 'copy-url':
        copyUrl(tab).catch((error: unknown) => console.warn('Copy URL failed', error));
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
 * Show or close Search over the page (the shortcut grants temporary access). With the panel focused, the page would get
 * none of its keys, not even Escape: the panel opens it then, and sends it the keys (`openSearch`). Where nothing can
 * show over the page, the panel shows its own.
 */
function openPalette(tab: Browser.tabs.Tab | undefined): void {
  if (tab?.windowId === undefined) return;
  const windowId = tab.windowId;
  // The committed URL on purpose, not `tabUrl()`: the script runs in the page showing, not one still loading.
  if (tab.id === undefined || !canHostOverlay(tab.url)) {
    openInPanel(windowId); // synchronous: sidePanel.open only works during the shortcut's gesture
    return;
  }
  const tabId = tab.id;
  void panelHasFocus(windowId).then(async (focused) => {
    if (focused) {
      requestPanelSearch(windowId); // the panel is open (it has focus): no need to open it
      return;
    }
    try {
      await injectPalette(tabId);
      await browser.tabs.sendMessage(tabId, { type: PALETTE_TOGGLE }, { frameId: 0 });
    } catch {
      // e.g. file:// pages without file access. Too late to open the panel (the gesture is over): only an open one can
      // show Search, and a flag left for a closed one would open Search whenever it next opens.
      if (await isPanelOpen(windowId)) requestPanelSearch(windowId);
    }
  });
}

function openInPanel(windowId: number): void {
  browser.sidePanel.open({ windowId }).catch(() => undefined);
  requestPanelSearch(windowId);
}

/**
 * Leave the window's panel a flag to toggle its Search, now or once it opens (`watchPaletteRequests`): over the page,
 * or in the panel where nothing can show over the page.
 */
function requestPanelSearch(windowId: number): void {
  void pendingPaletteItem.getValue().then((pending) => pendingPaletteItem.setValue({ ...pending, [windowId]: true }));
}
