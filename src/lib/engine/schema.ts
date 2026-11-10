/** Types and constants of the persisted model. Pure: safe to import anywhere, including tests. */

/** A tab tied to a saved entry. Tab ids are only valid for the browser session. */
export interface Binding {
  kind: 'pin' | 'favorite';
  id: string;
}

export interface SpaceMeta {
  hue: number;
}

export interface ArchiveEntry {
  id: string;
  title: string;
  url: string;
  spaceName: string;
  archivedAt: number;
}

export interface Settings {
  /** Close unpinned tabs after this many idle hours. 0 = never. */
  archiveAfterHours: number;
  /** A collapsed folder still shows its pins with an open tab (Arc's way); off, it hides everything in it. */
  collapsedFoldersShowOpenTabs: boolean;
}

export const DEFAULT_SETTINGS: Settings = { archiveAfterHours: 12, collapsedFoldersShowOpenTabs: true };

/** Settings as stored, with a default for each one saved before it existed (or anything missing). */
export function completeSettings(stored: Partial<Settings> | null | undefined): Settings {
  return { ...DEFAULT_SETTINGS, ...stored };
}

export interface RootIds {
  rootId: string;
  favoritesId: string;
}

/** The bookmark folder holding everything (named after the extension, so it's clear what it's for). */
export const ROOT_TITLE = 'Volet';
export const FAVORITES_TITLE = 'Favorites';
export const DEFAULT_SPACE_NAME = 'Volet 1 (click to rename)';
export const ARCHIVE_LIMIT = 500;
