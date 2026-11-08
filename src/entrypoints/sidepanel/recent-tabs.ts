import { previewCloseShortcutItem } from '@/lib/engine/recent-tabs/preview-close-shortcut-storage';
import { chromeRecentTabsPanel } from '@/lib/state/chrome/recent-tabs-panel';
import { watchRelayedRecentTabKeys } from '@/lib/ui/recent-tabs/relay-keys';

/** With the panel focused, the page showing the recent tab switcher gets no key events: the panel watches them for it. */
export function relayRecentTabKeys(windowId: number): void {
  const client = chromeRecentTabsPanel(windowId);
  const keys = watchRelayedRecentTabKeys(client.send);
  client.onAsk(keys.holds);
  const configure = (value: unknown) => keys.configure(typeof value === 'string' ? value : '');
  void previewCloseShortcutItem.getValue().then(configure).catch(() => undefined);
  previewCloseShortcutItem.watch(configure);
}
