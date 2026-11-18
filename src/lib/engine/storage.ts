import { storage } from 'wxt/utils/storage';
import type { ImportedSidebar } from '../import/types';
import { type ArchiveEntry, type Binding, DEFAULT_SETTINGS, type RootIds, type Settings, type SpaceMeta } from './schema';

export * from './schema';

// Session: tab and group ids change on every browser restart, so these are rebuilt then.
/** tabId → binding */
export const bindingsItem = storage.defineItem<Record<string, Binding>>('session:bindings', { fallback: {} });
/** groupId → spaceId */
export const groupSpacesItem = storage.defineItem<Record<string, string>>('session:groupSpaces', { fallback: {} });
/** windowId → spaceId */
export const activeSpacesItem = storage.defineItem<Record<string, string>>('session:activeSpaces', { fallback: {} });
/** windowId → spaceId → tabId last active in that Space */
export const lastActiveItem = storage.defineItem<Record<string, Record<string, number>>>('session:lastActive', {
  fallback: {},
});
/** tabId → last time it was active (ms) */
export const tabActivityItem = storage.defineItem<Record<string, number>>('session:tabActivity', { fallback: {} });
/** windowId → true when the palette should open in that window's side panel */
export const pendingPaletteItem = storage.defineItem<Record<string, boolean>>('session:pendingPalette', {
  fallback: {},
});
/**
 * windowId → the tab left in front when switching to a Space with no open tab: the sidebar stays
 * on that Space while it shows, instead of following it back to its own.
 */
export const parkedTabsItem = storage.defineItem<Record<string, number>>('session:parkedTabs', { fallback: {} });
/** windowId → true while that window shows the side panel */
export const openPanelsItem = storage.defineItem<Record<string, true>>('session:openPanels', { fallback: {} });

// Local: device-specific (bookmark ids differ between devices).
export const rootItem = storage.defineItem<RootIds | null>('local:root', { fallback: null });
/** Folders shown open. Every other folder is collapsed: one Volet didn't make (an import, a reinstall, Chrome's bookmarks, sync). */
export const openFoldersItem = storage.defineItem<string[]>('local:openFolders', { fallback: [] });
export const archiveItem = storage.defineItem<ArchiveEntry[]>('local:archive', { fallback: [] });
/** Arc's sidebar as last read from its file (by the import page, or the panel when it may re-read it). */
export const arcSidebarItem = storage.defineItem<ImportedSidebar | null>('local:arcSidebar', { fallback: null });
/**
 * bookmark id → the title Volet gave that pin or favorite from its page. While it still has that
 * title, it follows the page (`engine/titles.ts`); once someone renames it, it's theirs.
 */
export const autoTitlesItem = storage.defineItem<Record<string, string>>('local:autoTitles', { fallback: {} });
/**
 * bookmark id → the page its tab was last on. Which tab is whose (`bindingsItem`) is forgotten when Chrome restarts or
 * the extension reloads; this finds a tab that had left its pin's or favorite's page again (`ownerOf`).
 */
export const lastPagesItem = storage.defineItem<Record<string, string>>('local:lastPages', { fallback: {} });
/** Ids of the Arc Spaces imported on this device. */
export const importedArcSpacesItem = storage.defineItem<string[]>('local:importedArcSpaces', { fallback: [] });
/** Show the "Coming from Arc?" card: set on install, cleared when dismissed or once something is imported. */
export const arcInviteItem = storage.defineItem<boolean>('local:arcInvite', { fallback: false });
/** The welcome page's "Keep it on the right": the panel's side is settled even though it isn't on the left. */
export const panelSideKeptItem = storage.defineItem<boolean>('local:panelSideKept', { fallback: false });

// Sync: follows the user across devices. Keyed by Space name since bookmark ids differ per device.
export const spaceMetaItem = storage.defineItem<Record<string, SpaceMeta>>('sync:spaceMeta', { fallback: {} });
export const settingsItem = storage.defineItem<Settings>('sync:settings', { fallback: DEFAULT_SETTINGS });
