import { fakeRecentTabsClient } from '@/lib/state/fake/fake-recent-tabs';
import { mountRecentTabsOverlay } from '@/lib/ui/recent-tabs/mount-overlay';
import { feedCycle, RecentTabsFeed } from '@/lib/ui/recent-tabs/recent-tabs-feed';
import { RecentTabsState } from '@/lib/ui/recent-tabs/recent-tabs-state.svelte';
import { listenRecentTabKeys } from '@/lib/ui/recent-tabs/recent-tabs-keys';

// The tab switcher over a sample page, on fake tabs, for fast visual iteration.
// ?theme=dark or ?theme=light forces a color scheme (otherwise the system's); ?hue=N sets the Volet's color.
const params = new URLSearchParams(location.search);
const theme = params.get('theme');
const hue = Number(params.get('hue'));

const feed = new RecentTabsFeed();
if (params.has('hue') && Number.isFinite(hue)) feed.tint(hue);
const cycle = feedCycle(feed, fakeRecentTabsClient());
mountRecentTabsOverlay(new RecentTabsState(feed, cycle), { scheme: theme === 'dark' || theme === 'light' ? theme : undefined });
// Arrow keys, Enter and Escape work as on a page; no modifier is held, so letting go of one never switches.
listenRecentTabKeys(cycle, async () => false);

const open = () => cycle.step();
document.addEventListener('keydown', (event) => {
  if (event.key !== ' ' || cycle.active) return;
  event.preventDefault();
  open();
});
open();
