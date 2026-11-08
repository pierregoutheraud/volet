import { browser } from 'wxt/browser';
import { previewCloseShortcutItem } from '@/lib/engine/recent-tabs/preview-close-shortcut-storage';
import { isRelayKey } from '@/lib/model/recent-tab-keys';
import { isCycleModifier } from '@/lib/model/recent-tab-shortcut';
import {
  chromeRecentTabsClient, loadRecentTabsOverlay, relayHoldsModifier, sendRelayKey,
} from '@/lib/state/chrome/recent-tabs-client';
import type { RecentTabsHost } from '@/lib/ui/recent-tabs/host';
import { listenRecentTabKeys } from '@/lib/ui/recent-tabs/recent-tabs-keys';
import { feedCycle, RecentTabsFeed } from '@/lib/ui/recent-tabs/recent-tabs-feed';
import { watchRelayedRecentTabKeys } from '@/lib/ui/recent-tabs/relay-keys';

type Respond = (response: unknown) => void;

const isMessage = (value: unknown): value is { type: unknown } =>
  typeof value === 'object' && value !== null && 'type' in value;

/** Follow the close shortcut recorded in settings. Returns how to stop. */
function followCloseShortcut(configure: (shortcut: string) => void): () => void {
  const apply = (value: unknown) => configure(typeof value === 'string' ? value : '');
  void previewCloseShortcutItem.getValue().then(apply).catch(() => undefined);
  return previewCloseShortcutItem.watch(apply);
}

/**
 * On every website, from `document_start`, in every frame: Chrome's commands only report the shortcut being pressed,
 * so this watches its modifier being let go. Kept small, as it runs on every page: the overlay (Svelte, its styles)
 * is its own script, added on the first press (`recent-tabs-overlay.ts`).
 */
export default defineUnlistedScript(() => {
  if (window.__voletRecentTabs) return;
  window.__voletRecentTabs = window === window.top ? startPage() : startFrame();
});

/** The page's top frame: the switcher itself, its keys and the worker's messages. */
function startPage(): RecentTabsHost {
  const feed = new RecentTabsFeed();
  const cycle = feedCycle(feed, chromeRecentTabsClient({ onhue: (hue) => feed.tint(hue) }));
  const keys = listenRecentTabKeys(cycle, relayHoldsModifier);
  const stopClose = followCloseShortcut(keys.configure);
  /**
   * Opened by the Volet panel's button, which sends it the keys while it shows: the panel hears when it closes, however
   * it does (a tab picked here, the page hidden), to have its keys back.
   */
  let fromPanel = false;
  const stopClosedNotice = feed.subscribe(() => {
    if (!fromPanel || cycle.active) return;
    fromPanel = false;
    browser.runtime.sendMessage({ type: 'recent-tabs:closed' }).catch(() => undefined);
  });
  let overlay: Promise<void> | undefined;
  const loadOverlay = () => {
    overlay ??= loadRecentTabsOverlay().catch((error: unknown) => {
      overlay = undefined;
      console.warn('Recent tabs overlay failed to load', error);
    });
  };

  const message = (value: unknown, _sender: unknown, respond: Respond) => {
    if (!isMessage(value)) return;
    if (value.type === 'recent-tabs:step' && 'shortcut' in value && typeof value.shortcut === 'string') {
      const offset = 'offset' in value ? value.offset : 1;
      if (offset !== 1 && offset !== -1) return;
      loadOverlay();
      keys.step(value.shortcut, offset);
      respond({ ok: true });
    } else if (value.type === 'recent-tabs:open') {
      loadOverlay();
      keys.open();
      fromPanel = true;
      respond({ ok: true });
    } else if (value.type === 'recent-tabs:relay-key' && 'key' in value && isRelayKey(value.key)) {
      keys.fromRelay(value.key);
      respond({ ok: true });
    } else if (value.type === 'recent-tabs:visible') {
      respond({ visible: cycle.active });
    } else if (value.type === 'recent-tabs:disable') {
      host.dispose();
      respond({ ok: true });
    }
  };
  const host: RecentTabsHost = {
    switcher: { cycle, feed },
    dispose() {
      keys.dispose();
      stopClose();
      stopClosedNotice();
      browser.runtime.onMessage.removeListener(message);
      host.removeOverlay?.();
      delete window.__voletRecentTabs;
    },
  };
  browser.runtime.onMessage.addListener(message);
  return host;
}

/**
 * A frame of the page (an editor's, an embed's): while it has focus, the page's top frame sees no keys, so this tells
 * it about the modifier and the switcher's keys, through the worker. It reads the close shortcut the first time the
 * page asks, so frames that never take part (ads, most embeds) never do.
 */
function startFrame(): RecentTabsHost {
  const keys = watchRelayedRecentTabKeys<undefined>((_target, key) => sendRelayKey(key));
  let stopClose: (() => void) | undefined;
  const message = (value: unknown, _sender: unknown, respond: Respond) => {
    if (!isMessage(value)) return;
    if (value.type === 'recent-tabs:frame-holds' && 'modifier' in value && isCycleModifier(value.modifier)) {
      stopClose ??= followCloseShortcut(keys.configure);
      // Only the frame holding it answers: Chrome hands the page the first answer, and none means no frame holds it.
      if (keys.holds(undefined, value.modifier)) respond({ holds: true });
    } else if (value.type === 'recent-tabs:disable') {
      host.dispose();
      respond({ ok: true });
    }
  };
  const host: RecentTabsHost = {
    dispose() {
      keys.dispose();
      stopClose?.();
      browser.runtime.onMessage.removeListener(message);
      delete window.__voletRecentTabs;
    },
  };
  browser.runtime.onMessage.addListener(message);
  return host;
}
