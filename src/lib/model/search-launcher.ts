import { createContext } from 'svelte';
import type { PaletteKey, RelayedText } from './palette-relay';

/**
 * Where Search shows: over the page in front (the panel sends it its keys, `palette-relay.ts`), in the panel (only
 * where nothing can show over the page: Chrome's pages, the Web Store, a site Volet can't access), or nowhere.
 */
export type SearchMode = 'closed' | 'page' | 'panel';

/** The Volet panel's way to Search: its button, ⌘K and "/", and the shortcut pressed while the panel has the keyboard. */
export interface SearchLauncher {
  /** Reactive. */
  readonly mode: SearchMode;
  /** Chrome's shortcut for Search as Chrome shows it (`⌃M`), or empty while unassigned (reactive). */
  readonly shortcut: string;
  /** What Search over the page holds when the panel takes over, for the panel's field to start from (reactive). */
  readonly seed: RelayedText;
  /** The highlighted result's title, for screen readers in the panel (reactive). */
  readonly announcement: string;
  toggle(): void;
  close(): void;
  /** The panel's field changed (its text or selection). */
  text(state: RelayedText): void;
  key(key: PaletteKey): void;
  /** The panel's field lost the keyboard. */
  leave(): void;
}

/** Undefined where Search isn't wired in: the panel then shows no button for it. */
export const [getSearchLauncher, setSearchLauncher] = createContext<SearchLauncher | undefined>();
