import { previewCloseShortcutItem } from '@/lib/engine/recent-tabs/preview-close-shortcut-storage';
import { CYCLE_COMMAND } from '@/lib/model/recent-tab-shortcut';
import type { RecentTabsLauncher } from '@/lib/model/recent-tabs-launcher';
import { watchCommandShortcut } from '@/lib/state/chrome/command-shortcut';
import { chromeRecentTabsPanel } from '@/lib/state/chrome/recent-tabs-panel';
import { watchRelayedRecentTabKeys } from '@/lib/ui/recent-tabs/relay-keys';

/**
 * With the panel focused, the page showing the recent tab switcher gets no key events: the panel watches them for it.
 * Hands back the panel's button for it, which opens it over the page in front (the panel then has focus, so the keys).
 */
export function relayRecentTabKeys(windowId: number): RecentTabsLauncher {
  const client = chromeRecentTabsPanel(windowId);
  let open = $state(false);
  const keys = watchRelayedRecentTabKeys(client.send, (watching) => { open = watching; });
  client.onAsk(keys.holds);
  client.onClosed(keys.ended);
  let shortcut = $state('');
  watchCommandShortcut(CYCLE_COMMAND, (value) => { shortcut = value; });
  const configure = (value: unknown) => keys.configure(typeof value === 'string' ? value : '');
  void previewCloseShortcutItem.getValue().then(configure).catch(() => undefined);
  previewCloseShortcutItem.watch(configure);
  // A click anywhere else in the panel closes the switcher, like one on the page around it. The button toggles it.
  window.addEventListener('pointerdown', (event) => {
    const onButton = event.target instanceof Element && event.target.closest('[data-recent-tabs-button]');
    if (keys.watching && !onButton) keys.dismiss();
  }, true);
  return {
    get open() {
      return open;
    },
    get shortcut() {
      return shortcut;
    },
    toggle() {
      if (keys.watching) {
        keys.dismiss();
        return;
      }
      void client.open().then((tabId) => {
        if (tabId !== undefined) keys.open(tabId);
      }).catch((error: unknown) => console.warn('Recent tabs failed to open', error));
    },
  };
}
