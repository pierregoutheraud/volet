import '@/lib/ui/recent-tabs/host';
import { mountRecentTabsOverlay } from '@/lib/ui/recent-tabs/mount-overlay';
import { RecentTabsState } from '@/lib/ui/recent-tabs/recent-tabs-state.svelte';

/**
 * The recent tab switcher's overlay, added by the worker to a page's top frame on the first press there
 * (`recent-tabs:overlay`). It shows the switcher the page script (`recent-tabs.ts`) left on its window.
 */
export default defineUnlistedScript(() => {
  const host = window.__voletRecentTabs;
  const switcher = host?.switcher;
  if (!host || !switcher || host.removeOverlay) return;
  host.removeOverlay = mountRecentTabsOverlay(new RecentTabsState(switcher.feed, switcher.cycle));
});
