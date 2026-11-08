import { browser, type Browser } from 'wxt/browser';
import type { RelayKey } from '@/lib/model/recent-tab-keys';
import { isCycleModifier, type CycleModifier } from '@/lib/model/recent-tab-shortcut';

/** Messages between the Volet panel and the pages of its window showing the recent tab switcher. */
export function chromeRecentTabsPanel(windowId: number): {
  onAsk: (holds: (tabId: number, modifier: CycleModifier) => boolean) => () => void;
  send: (tabId: number, key: RelayKey) => void;
} {
  return {
    onAsk(holds) {
      const listener = (message: unknown, sender: Browser.runtime.MessageSender, respond: (response: unknown) => void) => {
        if (typeof message !== 'object' || message === null || !('type' in message) || message.type !== 'recent-tabs:panel-holds') return;
        const tab = sender.tab;
        if (tab?.id === undefined || tab.windowId !== windowId || sender.frameId !== 0) return;
        if (!('modifier' in message) || !isCycleModifier(message.modifier)) return;
        respond({ holds: holds(tab.id, message.modifier) });
      };
      browser.runtime.onMessage.addListener(listener);
      return () => browser.runtime.onMessage.removeListener(listener);
    },
    send(tabId, key) {
      browser.tabs.sendMessage(tabId, { type: 'recent-tabs:relay-key', key }, { frameId: 0 }).catch(() => undefined);
    },
  };
}
