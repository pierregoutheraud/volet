import type { SpaceItem } from '../model/types';
import type { ImportedSidebar } from '../import/types';
import type { PaletteItem } from './palette/types';

/** Every change the UI can ask for. The service worker runs them one at a time. */
export type Command =
  | { type: 'activateTab'; tabId: number }
  /** Activate a tab and bring its window to the front (it may be in another window). */
  | { type: 'focusTab'; tabId: number }
  | { type: 'closeTab'; windowId: number; tabId: number }
  | { type: 'toggleMute'; tabId: number }
  | { type: 'newTab'; windowId: number; spaceId?: string; url?: string }
  | { type: 'clearTemporary'; windowId: number; spaceId: string }
  /** Move a temporary tab to a position among a Space's temporary tabs (index omitted = end). */
  | { type: 'moveTab'; windowId: number; tabId: number; spaceId: string; index?: number }
  | { type: 'openPin'; windowId: number; pinId: string }
  | { type: 'unloadPin'; windowId: number; pinId: string }
  | { type: 'resetPin'; windowId: number; pinId: string }
  /** Make the page a pin's or favorite's tab is on its new home. */
  | { type: 'setHome'; windowId: number; id: string }
  /** Save a temporary tab as a pin inside a Space folder (or subfolder). */
  | { type: 'pinTab'; windowId: number; tabId: number; parentId: string; index?: number }
  /** Pin the tab if it isn't saved; unpin it (or remove it from favorites) if it is. */
  | { type: 'togglePin'; windowId: number; tabId: number }
  /** Remove a pin, keeping (or opening) its tab as a temporary tab. */
  | { type: 'unpin'; windowId: number; pinId: string; spaceId: string; index?: number }
  | { type: 'moveBookmark'; id: string; parentId: string; index?: number }
  | { type: 'renameBookmark'; id: string; title: string }
  | { type: 'deleteBookmark'; windowId: number; id: string }
  | { type: 'createFolder'; parentId: string; index?: number; title: string }
  /** Create a folder and put items in it, in order (pins and folders move in, tabs are pinned). */
  | { type: 'createFolderWith'; windowId: number; parentId: string; index?: number; title: string; items: SpaceItem[] }
  | { type: 'openFavorite'; windowId: number; favoriteId: string }
  | { type: 'addFavorite'; windowId: number; tabId: number; index?: number }
  /** Turn a pin into a favorite (its bookmark moves to Favorites, its open tab follows). */
  | { type: 'favoritePin'; windowId: number; pinId: string; index?: number }
  | { type: 'removeFavorite'; windowId: number; favoriteId: string }
  /** Reorder favorites; `index` is the final position. */
  | { type: 'moveFavorite'; favoriteId: string; index: number }
  | { type: 'switchSpace'; windowId: number; spaceId: string }
  /** Switch to the next (+1) or previous (-1) Space, wrapping around. */
  | { type: 'shiftSpace'; windowId: number; offset: 1 | -1 }
  | { type: 'createSpace'; windowId: number; name?: string; hue?: number }
  | { type: 'renameSpace'; spaceId: string; name: string }
  | { type: 'setSpaceHue'; spaceId: string; hue: number }
  | { type: 'moveSpace'; spaceId: string; index: number }
  | { type: 'deleteSpace'; windowId: number; spaceId: string }
  | { type: 'reopenArchived'; windowId: number; entryId: string }
  | { type: 'openUrl'; windowId: number; url: string }
  /** Add imported Spaces (with their pins) and favorites. */
  | { type: 'importSidebar'; sidebar: ImportedSidebar }
  | { type: 'openSettings' }
  | { type: 'openImport' }
  | { type: 'search'; windowId: number; text: string };

export interface CommandMessage {
  type: 'command';
  command: Command;
}

/** Sent by a side panel when it opens, so the worker can tidy that window. */
export interface HelloMessage {
  type: 'hello';
  windowId: number;
}

/** Palette search; `windowId` is omitted when sent from a page (the sender's tab tells). */
export interface PaletteQueryMessage {
  type: 'palette:query';
  windowId?: number;
  text: string;
}

export interface PaletteRunMessage {
  type: 'palette:run';
  windowId?: number;
  item: PaletteItem;
}

/** From the Volet panel: Search over the window's active page, or in the panel where nothing can show there. */
export interface PaletteOpenMessage {
  type: 'palette:open';
  windowId: number;
}

export type RuntimeMessage = CommandMessage | HelloMessage | PaletteQueryMessage | PaletteRunMessage | PaletteOpenMessage;

export type CommandResult = { ok: true; value?: unknown } | { ok: false; error: string };
