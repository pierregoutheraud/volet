import { browser, type Browser } from 'wxt/browser';
import type { RelayKey } from '@/lib/model/recent-tab-keys';
import { cycleShortcut, isCycleModifier, type CycleModifier } from '@/lib/model/recent-tab-shortcut';

type Respond = (response: unknown) => void;

/** Messages between the Volet panel and the pages of its window showing the recent tab switcher. */
export function chromeRecentTabsPanel(windowId: number): {
  onAsk: (holds: (tabId: number, modifier: CycleModifier) => boolean) => () => void;
  send: (tabId: number, key: RelayKey) => void;
  open: () => Promise<number | undefined>;
  onClosed: (closed: (tabId: number) => void) => () => void;
  shortcut: () => Promise<string>;
} {
  /** Messages of `type` from the top frame of a page in this window. */
  const fromPage = (type: string, handle: (message: object, tabId: number, respond: Respond) => void) => {
    const listener = (message: unknown, sender: Browser.runtime.MessageSender, respond: Respond) => {
      if (typeof message !== 'object' || message === null || !('type' in message) || message.type !== type) return;
      const tab = sender.tab;
      if (tab?.id === undefined || tab.windowId !== windowId || sender.frameId !== 0) return;
      handle(message, tab.id, respond);
    };
    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
  };
  return {
    onAsk(holds) {
      return fromPage('recent-tabs:panel-holds', (message, tabId, respond) => {
        if (!('modifier' in message) || !isCycleModifier(message.modifier)) return;
        respond({ holds: holds(tabId, message.modifier) });
      });
    },
    send(tabId, key) {
      browser.tabs.sendMessage(tabId, { type: 'recent-tabs:relay-key', key }, { frameId: 0 }).catch(() => undefined);
    },
    /** Open the switcher over the window's active page (the panel's button). Resolves to that page's tab, if it shows. */
    async open() {
      const answer: unknown = await browser.runtime.sendMessage({ type: 'recent-tabs:open', windowId });
      const tabId = typeof answer === 'object' && answer !== null && 'tabId' in answer ? answer.tabId : undefined;
      return typeof tabId === 'number' ? tabId : undefined;
    },
    /** A page closed the switcher the panel opened on it, however it closed. */
    onClosed(closed) {
      return fromPage('recent-tabs:closed', (_message, tabId) => closed(tabId));
    },
    /** The cycling shortcut as Chrome shows it. Chrome reports no change to shortcuts: ask again when it may have one. */
    async shortcut() {
      return cycleShortcut(await browser.commands.getAll());
    },
  };
}
