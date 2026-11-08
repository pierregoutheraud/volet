import { browser, type Browser } from 'wxt/browser';
import { holdsModifier, isRelayKey } from '@/lib/model/recent-tab-keys';
import { isCycleModifier } from '@/lib/model/recent-tab-shortcut';
import { activeSpaceOf, hueOf, loadContext } from '../context';
import type { Engine } from '../engine';
import { loadFaviconImage } from '../favicon';
import { loadRecentTabs } from './history';
import type { PressesInFlight } from './presses';
import type { RecentTabPreviews } from './previews';
import { OVERLAY_FILE } from './registration';

type Message = { type: unknown } & Record<string, unknown>;

const isMessage = (value: unknown): value is Message => typeof value === 'object' && value !== null && 'type' in value;

/**
 * The switcher's requests: from Volet's settings (`recent-tabs:setup`), from a page's top frame (its tabs, an action,
 * its overlay, asking its frames about the modifier, waiting for its presses), and from a page's frames (keys for the
 * top frame, the only message a frame may send). Only actions wait for the engine.
 */
export function listenForRecentTabMessages({ engine, previews, presses, setup, log }: {
  engine: Engine;
  previews: RecentTabPreviews;
  presses: PressesInFlight;
  setup: () => Promise<boolean>;
  log: (error: unknown) => void;
}): void {
  browser.runtime.onMessage.addListener((message: unknown, sender, respond) => {
    if (!isMessage(message)) return;
    const work = message.type === 'recent-tabs:setup'
      // Settings open in a tab, so their sender has one too: accept Volet's own pages, never a website.
      ? sender.url?.startsWith(`${location.origin}/`) ? setup().then((ready) => ({ ready })) : undefined
      : fromPage(message, sender);
    if (!work) return;
    work.then(respond, (error: unknown) => { log(error); respond({ ok: false }); });
    return true;
  });

  function fromPage(message: Message, sender: Browser.runtime.MessageSender): Promise<unknown> | undefined {
    const tab = sender.tab;
    if (tab?.id === undefined) return undefined;
    const tabId = tab.id;
    if (sender.frameId !== 0) {
      if (message.type !== 'recent-tabs:relay-key' || !isRelayKey(message.key)) return undefined;
      return browser.tabs.sendMessage(tabId, { type: 'recent-tabs:relay-key', key: message.key }, { frameId: 0 })
        .then(() => ({ ok: true }));
    }
    switch (message.type) {
      case 'recent-tabs:query':
        return query(tab.windowId);
      case 'recent-tabs:overlay':
        // Out of the engine queue, like attaching to open pages: a page still loading would hold every command.
        return browser.scripting.executeScript({
          target: { tabId, frameIds: [0] }, files: [OVERLAY_FILE], injectImmediately: true,
        }).then(() => ({ ok: true }));
      case 'recent-tabs:frames-hold': {
        if (!isCycleModifier(message.modifier)) return undefined;
        // Only a frame holding the modifier answers; with none, Chrome rejects for want of an answer.
        return browser.tabs.sendMessage(tabId, { type: 'recent-tabs:frame-holds', modifier: message.modifier })
          .then((answer: unknown) => ({ holds: holdsModifier(answer) }), () => ({ holds: false }));
      }
      case 'recent-tabs:settle':
        // The modifier went: answer once the presses Chrome reported before it have reached the page.
        return presses.settled(tabId).then(() => ({ ok: true }));
      case 'recent-tabs:activate':
      case 'recent-tabs:close': {
        const target = message.tabId;
        if (typeof target !== 'number' || !Number.isInteger(target)) return undefined;
        const close = message.type === 'recent-tabs:close';
        return browser.tabs.get(target).then((found) => {
          if (found.windowId !== tab.windowId) throw new Error('Recent tab belongs to another window');
          return engine.run(close
            ? { type: 'closeTab', windowId: tab.windowId, tabId: target }
            : { type: 'activateTab', tabId: target });
        }).then(() => ({ ok: true }));
      }
      default:
        return undefined;
    }
  }

  /**
   * The window's recent tabs, each with its icon and screenshot, and the active Volet's hue to tint the switcher. Out
   * of the engine queue, like Search's (`searchPalette`): the switcher shows whatever the engine is busy with.
   */
  async function query(windowId: number) {
    const [tabs, ctx] = await Promise.all([loadRecentTabs(windowId), loadContext(windowId)]);
    const shots = await previews.find(tabs);
    return {
      hue: hueOf(ctx, activeSpaceOf(ctx)),
      tabs: await Promise.all(tabs.map(async (recent) => ({
        ...recent,
        icon: await loadFaviconImage(recent.url),
        preview: shots.get(recent.id),
      }))),
    };
  }
}
