import { browser } from 'wxt/browser';
import { isPageToPanel, PALETTE_RELAY_PORT, type PageToPanel, type PanelToPage } from '@/lib/model/palette-relay';
import { send } from './command-client';

/** The panel's end of Search over a page (`palette-relay.ts`). */
export interface SearchConnection {
  post(message: PanelToPage): void;
  /** Let go: Search over the page closes, unless the page has the keyboard now. */
  close(): void;
}

/** The Volet panel's messages to the worker and to Search over the pages of its window. */
export function chromeSearchPanel(windowId: number): {
  open: () => Promise<{ tabId: number } | { panel: true }>;
  connect: (tabId: number, onmessage: (message: PageToPanel) => void, onclose: () => void) => SearchConnection;
} {
  return {
    /** Where Search opens: over the window's active page (the worker has added it there), or in the panel. */
    async open() {
      const answer: unknown = await send({ type: 'palette:open', windowId });
      const tabId = typeof answer === 'object' && answer !== null && 'tabId' in answer ? answer.tabId : undefined;
      return typeof tabId === 'number' ? { tabId } : { panel: true };
    },
    /** Search on the page opens as the panel connects. `onclose`: it closed, or its page went. */
    connect(tabId, onmessage, onclose) {
      const port = browser.tabs.connect(tabId, { name: PALETTE_RELAY_PORT, frameId: 0 });
      port.onMessage.addListener((message: unknown) => {
        if (isPageToPanel(message)) onmessage(message);
      });
      port.onDisconnect.addListener(() => onclose());
      return {
        post(message) {
          try {
            port.postMessage(message);
          } catch {
            // The page went; its disconnect is on its way.
          }
        },
        close() {
          port.disconnect();
        },
      };
    },
  };
}
