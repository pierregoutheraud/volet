import { nextHue } from '@/lib/engine/colors';
import type { Favorite, Folder, LiveTab, SidebarStore, Space, SpaceId, SpaceItem, TabId } from '@/lib/model/types';
import * as tree from '../tree';
import { seedFavorites, seedOpenFolders, seedSpaces, seedTabMap } from './seed';

const LOAD_MS = 600;

/**
 * In-memory store with realistic data, for building the UI without Chrome.
 * Built on the same pure tree operations as the Chrome store's optimistic updates.
 */
export class FakeSidebarStore implements SidebarStore {
  spaces = $state.raw<Space[]>(seedSpaces());
  favorites = $state.raw<Favorite[]>(seedFavorites());
  tabs = $state.raw<ReadonlyMap<TabId, LiveTab>>(seedTabMap());
  activeSpaceId = $state<SpaceId>('work');
  activeTabId = $state<TabId | undefined>(21);
  openFolders = $state.raw<ReadonlySet<string>>(seedOpenFolders());

  #nextId = 1000;
  /** Not reactive on purpose: only read when switching Spaces. */
  #lastActiveBySpace: Record<SpaceId, TabId> = {};

  // ───────────────────────────── tabs ─────────────────────────────

  activateTab(tabId: TabId) {
    this.activeTabId = tabId;
    this.#lastActiveBySpace[this.activeSpaceId] = tabId;
  }

  closeTab(tabId: TabId) {
    const space = tree.spaceOfTab(this.spaces, tabId);
    if (space && this.activeTabId === tabId) {
      const index = space.tabIds.indexOf(tabId);
      this.#activateOrClear(space.tabIds[index + 1] ?? space.tabIds[index - 1]);
    }
    this.spaces = tree.withoutTab(this.spaces, tabId);
    this.#setTab(tabId, undefined);
  }

  toggleMute(tabId: TabId) {
    const tab = this.tabs.get(tabId);
    if (tab) this.#setTab(tabId, { ...tab, muted: !tab.muted });
  }

  newTab() {
    const id = this.#createTab('chrome://newtab/', 'New Tab', false);
    this.spaces = tree.placeTemporary(this.spaces, id, this.activeSpaceId);
    this.activateTab(id);
  }

  clearTemporary(spaceId: SpaceId) {
    const space = this.spaces.find((candidate) => candidate.id === spaceId);
    const cleared = space ? tree.tabsToClear(space, this.activeTabId) : [];
    this.spaces = tree.withTemporaryCleared(this.spaces, spaceId, this.activeTabId);
    for (const id of cleared) this.#setTab(id, undefined);
  }

  moveTab(tabId: TabId, spaceId: SpaceId, index?: number) {
    this.#show(tree.moveTab(this, tabId, spaceId, index));
  }

  // ───────────────────────────── pins and folders ─────────────────────────────

  openPin(pinId: string) {
    const pin = tree.findPin(this.spaces, pinId);
    if (!pin) return;
    const space = tree.spaceOfNode(this.spaces, pinId);
    if (space) this.switchSpace(space.id);
    const tabId = pin.tabId ?? this.#createTab(pin.url, pin.title);
    this.spaces = tree.withPinTab(this.spaces, pinId, tabId);
    this.activateTab(tabId);
  }

  unloadPin(pinId: string) {
    const tabId = tree.findPin(this.spaces, pinId)?.tabId;
    if (tabId === undefined) return;
    this.spaces = tree.withPinTab(this.spaces, pinId, undefined);
    this.#setTab(tabId, undefined);
    if (this.activeTabId === tabId) this.#activateOrClear(undefined);
  }

  resetPin(pinId: string) {
    const pin = tree.findPin(this.spaces, pinId);
    if (pin?.tabId !== undefined) this.#load(pin.tabId, pin.url, pin.title);
  }

  setPinHome(pinId: string) {
    const pin = tree.findPin(this.spaces, pinId);
    const tab = pin?.tabId !== undefined ? this.tabs.get(pin.tabId) : undefined;
    if (!tab) return;
    this.spaces = tree.updatePin(this.spaces, pinId, (p) => ({ ...p, url: tab.url }));
  }

  pinTab(tabId: TabId, parentId: string, index?: number) {
    const tab = this.tabs.get(tabId);
    if (tab) this.#show(tree.pinTab(this, tab, `pin-${this.#nextId++}`, parentId, index));
  }

  unpin(pinId: string, spaceId: SpaceId, index?: number) {
    const pin = tree.findPin(this.spaces, pinId);
    if (!pin) return;
    // Unpinning an unloaded pin opens its page.
    if (pin.tabId === undefined) this.spaces = tree.withPinTab(this.spaces, pinId, this.#createTab(pin.url, pin.title));
    this.spaces = tree.unpinNode(this.spaces, pinId, spaceId, index);
  }

  moveNode(id: string, parentId: string, index?: number) {
    this.spaces = tree.moveNode(this.spaces, id, parentId, index);
  }

  renameNode(id: string, title: string) {
    this.spaces = tree.renameNode(this.spaces, id, title);
  }

  deleteNode(id: string) {
    this.spaces = tree.deleteNode(this.spaces, id);
  }

  createFolder(parentId: string) {
    const folder = this.#newFolder();
    this.spaces = tree.insertNode(this.spaces, folder, parentId, 0);
    return folder.id;
  }

  createFolderWith(items: SpaceItem[], parentId: string, index?: number) {
    const folder = this.#newFolder();
    this.#show(tree.folderWith(this, folder, parentId, index, items, this.tabs, () => `pin-${this.#nextId++}`));
    return folder.id;
  }

  toggleFolder(folderId: string) {
    this.openFolders = tree.toggled(this.openFolders, folderId);
  }

  // ───────────────────────────── favorites ─────────────────────────────

  openFavorite(favoriteId: string) {
    const favorite = this.favorites.find((f) => f.id === favoriteId);
    if (!favorite) return;
    const tabId = favorite.tabId ?? this.#createTab(favorite.url, favorite.title);
    this.favorites = this.favorites.map((f) => (f.id === favoriteId ? { ...f, tabId } : f));
    this.activateTab(tabId);
  }

  addFavorite(tabId: TabId, index?: number) {
    const tab = this.tabs.get(tabId);
    if (tab) this.#show(tree.favoriteTab(this, tab, `fav-${this.#nextId++}`, index));
  }

  favoritePin(pinId: string, index?: number) {
    this.#show(tree.pinToFavorite(this.spaces, this.favorites, pinId, index));
  }

  moveFavorite(favoriteId: string, index: number) {
    this.favorites = tree.moveItem(this.favorites, (favorite) => favorite.id === favoriteId, index);
  }

  removeFavorite(favoriteId: string) {
    this.#show(tree.removeFavorite(this, favoriteId, this.activeSpaceId));
  }

  setFavoriteHome(favoriteId: string) {
    const favorite = this.favorites.find((candidate) => candidate.id === favoriteId);
    const tab = favorite?.tabId !== undefined ? this.tabs.get(favorite.tabId) : undefined;
    if (!tab) return;
    this.favorites = this.favorites.map((f) => (f.id === favoriteId ? { ...f, url: tab.url, title: tab.title } : f));
  }

  // ───────────────────────────── Spaces ─────────────────────────────

  switchSpace(spaceId: SpaceId) {
    if (spaceId === this.activeSpaceId) return;
    this.activeSpaceId = spaceId;
    const remembered = this.#lastActiveBySpace[spaceId];
    this.activeTabId = remembered !== undefined && this.tabs.has(remembered) ? remembered : undefined;
  }

  createSpace() {
    this.addSpace();
  }

  /** Create a Space and show it; returns its id (the prototype's Arc import names it). */
  addSpace(): SpaceId {
    const id = `space-${this.#nextId++}`;
    const hue = nextHue(this.spaces.map((space) => space.hue));
    this.spaces = [...this.spaces, { id, name: `Volet ${this.spaces.length + 1}`, hue, pinned: [], tabIds: [] }];
    this.switchSpace(id);
    return id;
  }

  renameSpace(spaceId: SpaceId, name: string) {
    this.spaces = tree.updateSpace(this.spaces, spaceId, { name });
  }

  setSpaceHue(spaceId: SpaceId, hue: number) {
    this.spaces = tree.updateSpace(this.spaces, spaceId, { hue });
  }

  moveSpace(spaceId: SpaceId, index: number) {
    this.spaces = tree.moveItem(this.spaces, (space) => space.id === spaceId, index);
  }

  deleteSpace(spaceId: SpaceId) {
    if (this.spaces.length < 2) return;
    const { spaces, successor } = tree.deleteSpace(this.spaces, spaceId);
    this.spaces = spaces;
    if (this.activeSpaceId === spaceId && successor) this.switchSpace(successor.id);
  }

  // ───────────────────────────── internals ─────────────────────────────

  #show({ spaces, favorites }: tree.SpacesAndFavorites) {
    this.spaces = spaces;
    this.favorites = favorites;
  }

  /** Folders made here start open, as in the Chrome store. */
  #newFolder(): Folder {
    const folder: Folder = { kind: 'folder', id: `folder-${this.#nextId++}`, title: tree.NEW_FOLDER_TITLE, children: [] };
    this.openFolders = tree.including(this.openFolders, folder.id);
    return folder;
  }

  #createTab(url: string, title: string, load = true): TabId {
    const id = this.#nextId++;
    this.#setTab(id, { id, title, url, status: 'complete' });
    if (load) this.#load(id, url, title);
    return id;
  }

  /** Simulate a page load so loading states are visible in the prototype. */
  #load(tabId: TabId, url: string, title: string) {
    this.#patch(tabId, { status: 'loading', url });
    setTimeout(() => this.#patch(tabId, { status: 'complete', title }), LOAD_MS);
  }

  #patch(tabId: TabId, change: Partial<LiveTab>) {
    const tab = this.tabs.get(tabId);
    if (tab) this.#setTab(tabId, { ...tab, ...change });
  }

  #setTab(tabId: TabId, tab: LiveTab | undefined) {
    this.tabs = tree.withKey(this.tabs, tabId, tab);
  }

  #activateOrClear(tabId: TabId | undefined) {
    if (tabId === undefined) this.activeTabId = undefined;
    else this.activateTab(tabId);
  }

  // ───────────────────────────── pages ─────────────────────────────

  openSettings() {
    console.info('[proto] The settings page would open here.');
  }
}
