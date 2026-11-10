export type SpaceId = string;
export type TabId = number;

/** A live browser tab in the current window. */
export interface LiveTab {
  id: TabId;
  title: string;
  url: string;
  status: 'loading' | 'complete';
  /** The icon Chrome shows on the tab, once the page has one. */
  favIconUrl?: string;
  audible?: boolean;
  muted?: boolean;
}

/** A saved pinned entry (a bookmark). `url` is its home URL. */
export interface Pin {
  kind: 'pin';
  id: string;
  title: string;
  url: string;
  /** The open tab bound to this pin in the current window, if loaded. */
  tabId?: TabId;
  /**
   * Its title is a name someone gave it (a rename in Volet or in Chrome's bookmarks, a custom name
   * from Arc), not its page's: it shows that name whatever page its tab is on.
   */
  named?: boolean;
}

export interface Folder {
  kind: 'folder';
  id: string;
  title: string;
  children: PinnedNode[];
}

export type PinnedNode = Pin | Folder;

export interface Space {
  id: SpaceId;
  name: string;
  /** OKLCH hue (0 to 360) that tints the whole panel while the Space is active. */
  hue: number;
  pinned: PinnedNode[];
  /** Temporary tabs, in Chrome's tab order. */
  tabIds: TabId[];
}

/** Something listed on a Space's page: a temporary tab, or a pin or folder. */
export type SpaceItem = { kind: 'tab'; id: TabId } | { kind: 'node'; id: string };

/** A favorite: shared across all Spaces, shown in the grid at the top. */
export interface Favorite {
  id: string;
  title: string;
  url: string;
  tabId?: TabId;
}

/** An action's result: resolves once the store shows the change (immediately for synchronous stores). */
type Done = void | Promise<void>;

/** An action that creates something: resolves to its id (undefined if it couldn't be created). */
type Created = string | undefined | Promise<string | undefined>;

/** Everything the sidebar renders and can do. Implemented by the Chrome store and the fake store. */
export interface SidebarStore {
  readonly spaces: Space[];
  readonly favorites: Favorite[];
  readonly tabs: ReadonlyMap<TabId, LiveTab>;
  readonly activeSpaceId: SpaceId;
  readonly activeTabId: TabId | undefined;
  /** Folders shown open; every other folder is collapsed. */
  readonly openFolders: ReadonlySet<string>;
  /** Whether a collapsed folder still shows its pins with an open tab (a setting, on by default). */
  readonly collapsedFoldersShowOpenTabs: boolean;

  // Tabs
  activateTab(tabId: TabId): Done;
  closeTab(tabId: TabId): Done;
  toggleMute(tabId: TabId): Done;
  newTab(): Done;
  clearTemporary(spaceId: SpaceId): Done;
  /** Move a temporary tab (or a favorite's tab) to a Space, at an index among its temporary tabs. */
  moveTab(tabId: TabId, spaceId: SpaceId, index?: number): Done;

  // Pins and folders
  openPin(pinId: string): Done;
  /** Close a pin's tab but keep the pin. */
  unloadPin(pinId: string): Done;
  /** Navigate a pin's tab back to its home URL. */
  resetPin(pinId: string): Done;
  /** Make the page a pin's tab is on its new home. */
  setPinHome(pinId: string): Done;
  /** Save a tab as a pin in a Space (parentId = Space id) or folder. */
  pinTab(tabId: TabId, parentId: string, index?: number): Done;
  /** Remove a pin, keeping its page open as a temporary tab. */
  unpin(pinId: string, spaceId: SpaceId, index?: number): Done;
  /** Move a pin or folder into a Space or folder. */
  moveNode(id: string, parentId: string, index?: number): Done;
  renameNode(id: string, title: string): Done;
  /** Delete a pin or folder; open tabs stay as temporary tabs. */
  deleteNode(id: string): Done;
  /** Resolves with the new folder's id. */
  createFolder(parentId: string): Created;
  /**
   * Create a folder at `index` in a Space or folder and put `items` in it, in order: pins and
   * folders move in, tabs are pinned in. Resolves to the new folder's id.
   */
  createFolderWith(items: SpaceItem[], parentId: string, index?: number): Created;
  toggleFolder(folderId: string): Done;

  // Favorites
  openFavorite(favoriteId: string): Done;
  addFavorite(tabId: TabId, index?: number): Done;
  /** Turn a pin into a favorite: it leaves its Space, and its open tab (if any) goes with it. */
  favoritePin(pinId: string, index?: number): Done;
  moveFavorite(favoriteId: string, index: number): Done;
  removeFavorite(favoriteId: string): Done;
  /** Make the page a favorite's tab is on its new home. */
  setFavoriteHome(favoriteId: string): Done;

  // Spaces
  switchSpace(spaceId: SpaceId): Done;
  createSpace(): Done;
  renameSpace(spaceId: SpaceId, name: string): Done;
  setSpaceHue(spaceId: SpaceId, hue: number): Done;
  moveSpace(spaceId: SpaceId, index: number): Done;
  deleteSpace(spaceId: SpaceId): Done;

  // Volet's own pages
  /** Open Volet's settings in a tab. */
  openSettings(): Done;
}
