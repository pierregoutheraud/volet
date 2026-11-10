import type { Browser } from 'wxt/browser';
import { isPanelToPage, type PageToPanel } from '@/lib/model/palette-relay';
import type { PaletteState } from './palette-state.svelte';

/**
 * Search over a page, while the Volet panel has the keyboard (`palette-relay.ts`): the panel's field shows here, its
 * caret drawn over this one (`caret`), and its keys act here. A click into Search gives the page the keyboard: typing
 * then goes on here (`native`).
 */
export class PageRelay {
  /** The panel's caret and selection in the field, while the panel has the keyboard. */
  caret = $state<{ start: number; end: number } | undefined>();

  #palette: PaletteState;
  #close: () => void;
  #port: Browser.runtime.Port | undefined;
  #stopAnnouncing: (() => void) | undefined;

  /** `fromPanel`: opened by the panel, which is about to connect (the field takes no focus then). */
  constructor(palette: PaletteState, close: () => void, fromPanel: boolean) {
    this.#palette = palette;
    this.#close = close;
    this.caret = fromPanel ? { start: 0, end: 0 } : undefined;
  }

  /** The panel connected: it sends the keys from now on, starting from what Search holds (typed here, maybe). */
  attach(port: Browser.runtime.Port): void {
    this.#detach();
    this.#port = port;
    const palette = this.#palette;
    const end = palette.query.length;
    this.caret ??= { start: end, end };
    this.#post({ type: 'text', value: palette.query, ...this.caret });
    port.onMessage.addListener((message: unknown) => {
      if (this.#port !== port || !isPanelToPage(message)) return;
      if (message.type === 'key') {
        void palette.press(message.key, this.#close);
        return;
      }
      this.caret = { start: message.start, end: message.end };
      if (message.value !== palette.query) void palette.search(message.value);
    });
    // The panel let go. If it's because the user clicked into Search's field, typing goes on here (`native`, which the
    // field's focus called first); otherwise Search closes with it.
    port.onDisconnect.addListener(() => {
      if (this.#port !== port) return;
      this.#detach();
      if (this.caret) this.#close();
    });
    // Screen readers in the panel hear the highlighted result.
    this.#stopAnnouncing = $effect.root(() => {
      $effect(() => {
        this.#post({ type: 'selected', title: palette.items[palette.selected]?.title ?? '' });
      });
    });
  }

  /** The page has the keyboard (a click into Search): its own field and caret take over. */
  native(): void {
    this.caret = undefined;
  }

  /** Search closed: the panel stops sending keys. */
  end(): void {
    const port = this.#port;
    this.#detach();
    port?.disconnect();
  }

  #post(message: PageToPanel): void {
    try {
      this.#port?.postMessage(message);
    } catch {
      // The panel went away; its disconnect is on its way.
    }
  }

  #detach(): void {
    this.#stopAnnouncing?.();
    this.#stopAnnouncing = undefined;
    this.#port = undefined;
  }
}
