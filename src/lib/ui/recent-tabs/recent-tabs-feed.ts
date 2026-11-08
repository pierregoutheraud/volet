import { RecentTabCycle } from '@/lib/model/recent-tab-cycle';
import type { RecentTabsClient, RecentTabsView } from '@/lib/model/recent-tabs';

/**
 * What the switcher shows, handed from the page script to its overlay. Plain on purpose: the page script runs on every
 * website, and the overlay (Svelte, its styles) only loads on the first press (`RecentTabsState` follows this feed).
 */
export class RecentTabsFeed {
  view: RecentTabsView | null = null;
  /** The window's active Volet's hue, which tints the switcher like the side panel (Search's default until known). */
  hue = 268;
  #listeners = new Set<() => void>();

  show(view: RecentTabsView | null): void {
    this.view = view;
    this.#notify();
  }

  tint(hue: number): void {
    this.hue = hue;
    this.#notify();
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => { this.#listeners.delete(listener); };
  }

  #notify(): void {
    for (const listener of this.#listeners) listener();
  }
}

/** A tab cycle showing its gestures through `feed`. */
export function feedCycle(feed: RecentTabsFeed, client: RecentTabsClient): RecentTabCycle {
  return new RecentTabCycle({
    client,
    onchange: (view) => feed.show(view),
    onerror: (error) => console.warn('Recent tab cycle failed', error),
  });
}
