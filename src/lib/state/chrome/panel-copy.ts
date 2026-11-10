import { browser, type Browser } from 'wxt/browser';
import { PANEL_COPY_URL } from '@/lib/model/copy-url';

/**
 * Answer the worker's copy shortcut for this window's panel (`engine/copy-url.ts`): only a panel that has the keyboard
 * copies the link, then answers and calls `copied`; otherwise the page in front copies it.
 */
export function answerCopyRequests(windowId: number, copied: () => void): () => void {
  const listener = (message: unknown, sender: Browser.runtime.MessageSender, respond: (response: unknown) => void) => {
    if (typeof message !== 'object' || message === null || !('type' in message) || message.type !== PANEL_COPY_URL) return;
    // From the worker only: it has no tab.
    if (sender.tab || sender.id !== browser.runtime.id) return;
    if (!('windowId' in message) || message.windowId !== windowId || !document.hasFocus()) return;
    if (!('url' in message) || typeof message.url !== 'string') return;
    navigator.clipboard.writeText(message.url).then(
      () => {
        respond({ copied: true });
        copied();
      },
      () => respond({ copied: false }),
    );
    return true;
  };
  browser.runtime.onMessage.addListener(listener);
  return () => browser.runtime.onMessage.removeListener(listener);
}
