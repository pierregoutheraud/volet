import { mount } from 'svelte';
import { faviconSources } from '@/lib/model/favicon';
import type { RecentTab } from '@/lib/model/recent-tabs';
import type { TabId } from '@/lib/model/types';
import { FakeArcClient } from '@/lib/state/fake/fake-arc.svelte';
import { fakePaletteClient } from '@/lib/state/fake/fake-palette';
import { screenshot } from '@/lib/state/fake/fake-recent-tabs';
import { FakeSidebarStore } from '@/lib/state/fake/fake-store.svelte';
import StoreFrame from './StoreFrame.svelte';
import '@/app.css';

/**
 * The Chrome Web Store images, one scene per URL (`?scene=palette`), rendered by `store/capture.mjs`.
 * A scene sets the copy and the starting state; the capture script does the typing (Search). The screenshots are all
 * light, each in another of the colors a Volet can take (`HUE_SWATCHES`), none shared with the bar's other shutters.
 */
interface Scene {
  shot: 'screenshot' | 'promo' | 'marquee';
  headline?: string;
  detail: string;
  /** Space to show. */
  space?: string;
  /** The shown Space's color, one of `HUE_SWATCHES`. */
  hue?: number;
  /** Keep Arc's first-run card and the Arc Spaces offered by New Volet. */
  arc?: boolean;
  /** Show Search as it opens over a page. */
  searching?: boolean;
  /** Show the recent tab switcher as it opens over a page. */
  switching?: boolean;
}

const TAGLINE = 'Vertical tabs in Chrome, sorted into workspaces.';

const SCENES = {
  sidebar: {
    shot: 'screenshot',
    headline: 'Your tabs, sorted into Volets',
    detail: "Vertical tabs in Chrome's side panel, with pinned tabs, folders and favorites for each workspace.",
    hue: 268, // indigo
  },
  volets: {
    shot: 'screenshot',
    headline: 'A Volet for everything',
    detail: 'Work, a trip, a side project: each Volet keeps its own tabs and color. Switch with a swipe.',
    space: 'perso',
    hue: 152, // green
  },
  palette: {
    shot: 'screenshot',
    headline: 'Find any tab in a keystroke',
    detail: 'Open tabs, pins, favorites, archived tabs or the web, from any page.',
    hue: 330, // pink
    searching: true,
  },
  switcher: {
    shot: 'screenshot',
    headline: 'Jump back to a recent tab',
    detail: 'Hold Ctrl and press Q to see your four most recent tabs, each with a preview. Let go to switch.',
    hue: 205, // teal
    switching: true,
  },
  arc: {
    shot: 'screenshot',
    headline: 'Coming from Arc?',
    detail: 'Bring your Arc Spaces over, with their colors, pinned tabs, folders and favorites.',
    space: 'side',
    hue: 42, // orange
    arc: true,
  },
  promo: { shot: 'promo', detail: TAGLINE },
  marquee: { shot: 'marquee', detail: TAGLINE },
} satisfies Record<string, Scene>;

/**
 * The switcher's four most recent tabs, from the sidebar's own: the one in front, then the ones used before it, one
 * of them in another Volet. Their previews are drawn in each site's colors; their icons come from where the sidebar's
 * do (the switcher only shows the icon each tab comes with).
 */
const RECENT: [TabId, [string, string]][] = [
  [21, ['#ffffff', '#1b1b1b']],
  [22, ['#ffffff', '#f48024']],
  [10, ['#f5f5f5', '#1e1e1e']],
  [40, ['#ffffff', '#1a73e8']],
];

function recentTabs(store: FakeSidebarStore): RecentTab[] {
  return RECENT.flatMap(([id, colors]) => {
    const tab = store.tabs.get(id);
    return tab ? [{ id, title: tab.title, url: tab.url, icon: faviconSources(tab.url, 24)[0], preview: screenshot(colors) }] : [];
  });
}

const name = new URLSearchParams(location.search).get('scene') ?? '';
const scene: Scene = name in SCENES ? SCENES[name as keyof typeof SCENES] : SCENES.sidebar;

const store = new FakeSidebarStore();
const arc = new FakeArcClient(store);
if (!scene.arc) {
  arc.dismissInvite();
  arc.forget();
}
if (scene.space) store.switchSpace(scene.space);
if (scene.hue !== undefined) store.setSpaceHue(store.activeSpaceId, scene.hue);

mount(StoreFrame, {
  target: document.getElementById('app')!,
  props: {
    store,
    palette: fakePaletteClient(store),
    arc,
    shot: scene.shot,
    headline: scene.headline ?? '',
    detail: scene.detail,
    searching: scene.searching,
    switcherTabs: scene.switching ? recentTabs(store) : undefined,
  },
});
