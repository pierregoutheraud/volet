import { browser, type Browser } from 'wxt/browser';
import { PANEL_FOCUSED } from '@/lib/engine/side-panel';

/** Answer the worker's `panelHasFocus` for this window's panel: only a panel that has the keyboard answers. */
export function answerPanelFocus(windowId: number): () => void {
  const listener = (message: unknown, sender: Browser.runtime.MessageSender, respond: (response: unknown) => void) => {
    if (typeof message !== 'object' || message === null || !('type' in message) || message.type !== PANEL_FOCUSED) return;
    // From the worker only: it has no tab.
    if (sender.tab || sender.id !== browser.runtime.id) return;
    if (!('windowId' in message) || message.windowId !== windowId || !document.hasFocus()) return;
    respond({ focused: true });
  };
  browser.runtime.onMessage.addListener(listener);
  return () => browser.runtime.onMessage.removeListener(listener);
}
