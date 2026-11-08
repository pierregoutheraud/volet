import { mount, unmount } from 'svelte';
import { shadowMode } from '../primitives/shadow-mode';
import RecentTabsOverlay from './RecentTabsOverlay.svelte';
import type { RecentTabsState } from './recent-tabs-state.svelte';
import css from './recent-tabs.css?inline';

/**
 * Mount the switcher in its own closed shadow root at the end of the page: neither the page's styles nor ours leak,
 * and the page can't read your recent tabs' titles, addresses or screenshots in it.
 * Returns how to remove it. `scheme` forces a color scheme (the preview page); otherwise it follows the system.
 */
export function mountRecentTabsOverlay(state: RecentTabsState, { scheme }: { scheme?: 'light' | 'dark' } = {}): () => void {
  const host = document.createElement('volet-recent-tabs');
  const shadow = host.attachShadow({ mode: shadowMode(import.meta.env.MODE) });
  const style = document.createElement('style');
  style.textContent = css;
  const target = document.createElement('div');
  shadow.append(style, target);
  document.documentElement.append(host);
  const app = mount(RecentTabsOverlay, {
    target,
    props: { state, scheme, onchoose: (index) => state.cycle.commit(index), oncancel: () => state.cycle.cancel() },
  });
  return () => {
    void unmount(app);
    host.remove();
  };
}
