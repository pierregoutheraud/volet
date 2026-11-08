import { browser } from 'wxt/browser';
import { holdsModifier, type RelayKey } from '@/lib/model/recent-tab-keys';
import { isRecentTab, type RecentTabsClient } from '@/lib/model/recent-tabs';
import type { CycleModifier } from '@/lib/model/recent-tab-shortcut';

/**
 * Request recent tabs from the sender's window; Chrome writes stay in the engine. Each answer also carries the window's
 * active Volet's hue (`onhue`), like Search's.
 */
export function chromeRecentTabsClient({ onhue }: { onhue?: (hue: number) => void } = {}): RecentTabsClient {
  return {
    async load() {
      const response: unknown = await browser.runtime.sendMessage({ type: 'recent-tabs:query' });
      if (typeof response !== 'object' || response === null || !('tabs' in response) ||
        !Array.isArray(response.tabs) || !response.tabs.every(isRecentTab)) {
        throw new Error('Recent tabs query failed');
      }
      if ('hue' in response && typeof response.hue === 'number' && Number.isFinite(response.hue)) onhue?.(response.hue);
      return response.tabs;
    },
    async activate(tabId) {
      await runRecentTabAction({ type: 'recent-tabs:activate', tabId });
    },
    async close(tabId) {
      await runRecentTabAction({ type: 'recent-tabs:close', tabId });
    },
    async settle() {
      await runRecentTabAction({ type: 'recent-tabs:settle' });
    },
  };
}

/** Have the worker add the switcher's overlay to this page (its own script, kept off pages until it's needed). */
export async function loadRecentTabsOverlay(): Promise<void> {
  await runRecentTabAction({ type: 'recent-tabs:overlay' });
}

/**
 * Ask whoever has focus instead of this page whether it holds the modifier: the Volet panel of this page's window
 * (asked directly), or one of this page's frames (asked through the worker). Either one then sends its keys here.
 */
export async function relayHoldsModifier(modifier: CycleModifier): Promise<boolean> {
  const ask = async (type: string) => holdsModifier(await browser.runtime.sendMessage({ type, modifier }));
  const answers = await Promise.all(['recent-tabs:panel-holds', 'recent-tabs:frames-hold']
    .map((type) => ask(type).catch(() => false)));
  return answers.some(Boolean);
}

/** From a frame of the page: a key for the page's switcher, which the worker forwards to the page's top frame. */
export function sendRelayKey(key: RelayKey): void {
  browser.runtime.sendMessage({ type: 'recent-tabs:relay-key', key }).catch(() => undefined);
}

async function runRecentTabAction(message: { type: string; tabId?: number }): Promise<void> {
  const response: unknown = await browser.runtime.sendMessage(message);
  if (typeof response !== 'object' || response === null || !('ok' in response) || response.ok !== true) {
    throw new Error(`Recent tab action failed: ${message.type}`);
  }
}
