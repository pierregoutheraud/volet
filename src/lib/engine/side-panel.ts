import { browser } from 'wxt/browser';
import { openPanelsItem } from './storage';

/**
 * The sidebar shortcut. Chrome has no toggle and can't say which windows show the panel (side panel contexts have no
 * window id), so the worker keeps that list itself, from the panel's open and close events. It lives in session
 * storage because the worker is stopped when idle, usually while the panel stays open.
 */

/** Show the window's side panel, or hide it if it was showing. */
export function toggleSidePanel(windowId: number): void {
  // Asked before opening, so the answer describes the panel as it was when the shortcut was pressed.
  const wasOpen = isPanelOpen(windowId);
  // Synchronous: sidePanel.open only works during the shortcut's gesture. It does nothing when already open.
  browser.sidePanel.open({ windowId }).catch(() => undefined);
  void wasOpen
    .then((open) => (open ? browser.sidePanel.close({ windowId }) : undefined))
    .catch((error) => console.warn('toggle side panel', error));
}

/** Asked when the palette shortcut is pressed: a page shown next to a focused panel gets no keys (`answerPanelFocus`). */
export const PANEL_FOCUSED = 'palette:panel-focused';

/** Whether the window's panel has the keyboard: only a focused panel answers, so no answer (or no panel) means no. */
export async function panelHasFocus(windowId: number): Promise<boolean> {
  try {
    const answer: unknown = await browser.runtime.sendMessage({ type: PANEL_FOCUSED, windowId });
    return typeof answer === 'object' && answer !== null && 'focused' in answer && answer.focused === true;
  } catch {
    return false;
  }
}

/** Whether the window shows the panel, as far as its open and close events tell. */
export async function isPanelOpen(windowId: number): Promise<boolean> {
  return Boolean((await openPanelsItem.getValue())[windowId]);
}

/** Keep the list of windows showing the panel. The events arrived in Chrome 141 and 142, hence the guards. */
export function trackSidePanels(): void {
  browser.sidePanel.onOpened?.addListener(({ windowId }) => setPanelOpen(windowId, true));
  browser.sidePanel.onClosed?.addListener(({ windowId }) => setPanelOpen(windowId, false));
  browser.windows.onRemoved.addListener((windowId) => setPanelOpen(windowId, false));
}

// Opening and closing in several windows at once must not overwrite each other's change: one write at a time.
let writes = Promise.resolve();

function setPanelOpen(windowId: number, open: boolean): void {
  writes = writes
    .then(async () => {
      const panels = await openPanelsItem.getValue();
      if (Boolean(panels[windowId]) === open) return;
      const { [windowId]: _previous, ...rest } = panels;
      await openPanelsItem.setValue(open ? { ...rest, [windowId]: true } : rest);
    })
    .catch((error) => console.warn('side panel state', error));
}
