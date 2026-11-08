import { createSubscriber } from 'svelte/reactivity';
import type { RecentTabCycle } from '@/lib/model/recent-tab-cycle';
import type { RecentTabsView } from '@/lib/model/recent-tabs';
import type { RecentTabsFeed } from './recent-tabs-feed';

/** The overlay's reactive view of the page script's switcher: its feed, read inside effects, and its cycle to drive. */
export class RecentTabsState {
  readonly cycle: RecentTabCycle;
  readonly #feed: RecentTabsFeed;
  readonly #subscribe: () => void;

  constructor(feed: RecentTabsFeed, cycle: RecentTabCycle) {
    this.#feed = feed;
    this.cycle = cycle;
    this.#subscribe = createSubscriber((update) => feed.subscribe(update));
  }

  get view(): RecentTabsView | null {
    this.#subscribe();
    return this.#feed.view;
  }

  /** The window's active Volet's hue, which tints the switcher like the side panel. */
  get hue(): number {
    this.#subscribe();
    return this.#feed.hue;
  }
}
