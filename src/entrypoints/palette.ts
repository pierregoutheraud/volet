import { mount, unmount } from 'svelte';
import { browser } from 'wxt/browser';
import { PALETTE_RELAY_PORT, PALETTE_TOGGLE } from '@/lib/model/palette-relay';
import { chromePaletteClient } from '@/lib/state/chrome/palette-client';
import OverlayPalette from '@/lib/ui/palette/OverlayPalette.svelte';
import { PageRelay } from '@/lib/ui/palette/page-relay.svelte';
import { PaletteState } from '@/lib/ui/palette/palette-state.svelte';
import { shadowMode } from '@/lib/ui/primitives/shadow-mode';
import css from '@/lib/ui/palette/palette.css?inline';

/** Set on the page (Volet's isolated world) once Search is set up there, so adding the script again does nothing. */
const KEY = '__spacesPalette';
type Host = Window & { [KEY]?: true };

/**
 * Search over the current page, added to its top frame by the worker (`injectPalette`: site access, or the shortcut's
 * activeTab grant). It sets itself up once, then shows or closes on the shortcut (`palette:toggle`), and opens when
 * the Volet panel connects (`palette-relay`), which then sends it the keys. Renders in a closed shadow root: neither
 * the page's styles nor ours leak, and the page can't read your tabs in it.
 */
export default defineUnlistedScript(() => {
  const page = window as Host;
  if (page[KEY]) return;
  page[KEY] = true;
  setUp();
});

interface Shown {
  relay: PageRelay;
  close: () => void;
}

function setUp(): void {
  let shown: Shown | undefined;

  /** Show Search, unless it shows already. `fromPanel`: the panel is about to connect and send the keys. */
  const open = (fromPanel: boolean): Shown => {
    if (shown) return shown;
    const host = document.createElement('spaces-palette');
    const shadow = host.attachShadow({ mode: shadowMode(import.meta.env.MODE) });
    const style = document.createElement('style');
    style.textContent = css;
    const target = document.createElement('div');
    shadow.append(style, target);
    document.documentElement.append(host);

    const previousFocus = fromPanel ? null : (document.activeElement as HTMLElement | null);
    const palette = new PaletteState(chromePaletteClient());
    const close = () => {
      if (shown !== current) return;
      shown = undefined;
      relay.end();
      void unmount(app);
      host.remove();
      previousFocus?.focus?.();
    };
    const relay = new PageRelay(palette, close, fromPanel);
    const app = mount(OverlayPalette, { target, props: { palette, relay, onclose: close } });
    const current: Shown = { relay, close };
    shown = current;
    return current;
  };

  browser.runtime.onMessage.addListener((message: unknown, _sender, respond: (response: unknown) => void) => {
    if (typeof message !== 'object' || message === null || !('type' in message) || message.type !== PALETTE_TOGGLE) return;
    if (shown) shown.close();
    else open(false);
    respond({ ok: true });
  });
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== PALETTE_RELAY_PORT || port.sender?.id !== browser.runtime.id) return;
    open(true).relay.attach(port);
  });
  // Another tab came to the front (or the window was minimized): Search was for this page as it showed.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) shown?.close();
  });
}
