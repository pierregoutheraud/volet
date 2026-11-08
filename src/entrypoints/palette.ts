import { mount, unmount } from 'svelte';
import { chromePaletteClient } from '@/lib/state/chrome/palette-client';
import OverlayPalette from '@/lib/ui/palette/OverlayPalette.svelte';
import { shadowMode } from '@/lib/ui/primitives/shadow-mode';
import css from '@/lib/ui/palette/palette.css?inline';

/** Set on the page while the palette is shown, so running the shortcut again closes it. */
const KEY = '__spacesPalette';
type Host = Window & { [KEY]?: { close: () => void } };

/**
 * Injected into the current page by the palette shortcut (activeTab + scripting).
 * Renders in a closed shadow root: neither the page's styles nor ours leak, and the page can't read your tabs in it.
 */
export default defineUnlistedScript(() => {
  const page = window as Host;
  if (page[KEY]) {
    page[KEY].close();
    return;
  }

  const host = document.createElement('spaces-palette');
  const shadow = host.attachShadow({ mode: shadowMode(import.meta.env.MODE) });
  const style = document.createElement('style');
  style.textContent = css;
  const target = document.createElement('div');
  shadow.append(style, target);
  document.documentElement.append(host);

  const previousFocus = document.activeElement as HTMLElement | null;
  const close = () => {
    void unmount(app);
    host.remove();
    delete page[KEY];
    previousFocus?.focus?.();
  };
  const app = mount(OverlayPalette, { target, props: { client: chromePaletteClient(), onclose: close } });
  page[KEY] = { close };
});
