import { createContext } from 'svelte';

/** The Volet panel's button for the recent tab switcher: opens it over the page in front, or closes it again. */
export interface RecentTabsLauncher {
  /** Whether the switcher shows with the panel's keys going to it (reactive). */
  readonly open: boolean;
  /** The switcher's shortcut as Chrome shows it (`⌃Q`), or empty while unassigned (reactive). */
  readonly shortcut: string;
  toggle(): void;
}

/** Undefined where the switcher isn't wired in (the prototype): the panel then shows no button for it. */
export const [getRecentTabsLauncher, setRecentTabsLauncher] = createContext<RecentTabsLauncher | undefined>();
