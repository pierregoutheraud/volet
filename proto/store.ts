import { mount } from 'svelte';
import { FakeArcClient } from '@/lib/state/fake/fake-arc.svelte';
import { fakePaletteClient } from '@/lib/state/fake/fake-palette';
import { FakeSidebarStore } from '@/lib/state/fake/fake-store.svelte';
import StoreFrame from './StoreFrame.svelte';
import '@/app.css';

/**
 * The Chrome Web Store images, one scene per URL (`?scene=palette`), rendered by `store/capture.mjs`.
 * A scene sets the copy and the starting state; the capture script does the clicking (palette, menus, drags).
 */
interface Scene {
  shot: 'screenshot' | 'promo' | 'marquee';
  headline?: string;
  detail: string;
  scheme?: 'light' | 'dark';
  /** Space to show. */
  space?: string;
  /** Keep Arc's first-run card and the Arc Spaces offered by New Volet. */
  arc?: boolean;
  /** Show Search as it opens over a page. */
  searching?: boolean;
}

const TAGLINE = 'Vertical tabs in Chrome, sorted into workspaces.';

const SCENES = {
  sidebar: {
    shot: 'screenshot',
    headline: 'Your tabs, sorted into Volets',
    detail: "Vertical tabs in Chrome's side panel, with pinned tabs, folders and favorites for each workspace.",
  },
  volets: {
    shot: 'screenshot',
    headline: 'A Volet for everything',
    detail: 'Work, a trip, a side project: each Volet keeps its own tabs and color. Switch with a swipe.',
    scheme: 'dark',
    space: 'perso',
  },
  palette: {
    shot: 'screenshot',
    headline: 'Find any tab in a keystroke',
    detail: 'Open tabs, pins, favorites, archived tabs or the web, from any page.',
    searching: true,
  },
  drag: {
    shot: 'screenshot',
    headline: 'Drag tabs where they belong',
    detail: 'Pin and unpin, file into folders, or drop onto another Volet. A line shows where it lands.',
  },
  arc: {
    shot: 'screenshot',
    headline: 'Coming from Arc?',
    detail: 'Bring your Arc Spaces over, with their colors, pinned tabs, folders and favorites.',
    space: 'side',
    arc: true,
  },
  promo: { shot: 'promo', detail: TAGLINE },
  marquee: { shot: 'marquee', detail: TAGLINE },
} satisfies Record<string, Scene>;

const name = new URLSearchParams(location.search).get('scene') ?? '';
const scene: Scene = name in SCENES ? SCENES[name as keyof typeof SCENES] : SCENES.sidebar;

const store = new FakeSidebarStore();
const arc = new FakeArcClient(store);
if (!scene.arc) {
  arc.dismissInvite();
  arc.forget();
}
if (scene.space) store.switchSpace(scene.space);

mount(StoreFrame, {
  target: document.getElementById('app')!,
  props: {
    store,
    palette: fakePaletteClient(store),
    arc,
    shot: scene.shot,
    headline: scene.headline ?? '',
    detail: scene.detail,
    scheme: scene.scheme,
    searching: scene.searching,
  },
});
