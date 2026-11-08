import type { RecentTabCycle } from '@/lib/model/recent-tab-cycle';
import type { RecentTabsFeed } from './recent-tabs-feed';

/**
 * What the page script leaves on its window, which is Volet's isolated world (the page's own scripts never see it):
 * it keeps the script from starting twice, and hands the switcher to the overlay script, injected on the first press.
 */
export interface RecentTabsHost {
  /** The switcher, in the page's top frame only: frames just relay keys. */
  switcher?: { cycle: RecentTabCycle; feed: RecentTabsFeed };
  /** Set by the overlay script once it has mounted. */
  removeOverlay?: () => void;
  dispose: () => void;
}

declare global {
  interface Window { __voletRecentTabs?: RecentTabsHost }
}
