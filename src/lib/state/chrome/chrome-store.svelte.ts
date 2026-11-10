import { EMPTY_STATE, derive, type SidebarState } from '@/lib/engine/derive';
import type { Command } from '@/lib/engine/protocol';
import { completeSettings, DEFAULT_SETTINGS, openFoldersItem, settingsItem } from '@/lib/engine/storage';
import type { Favorite, Folder, LiveTab, SidebarStore, Space, SpaceId, SpaceItem, TabId } from '@/lib/model/types';
import { reuseContent } from '../reuse';
import * as tree from '../tree';
import { watchWindow } from './chrome-events';
import { sayHello, sendCommand } from './command-client';
import { loadSnapshot } from './load-snapshot';
import { RefreshGate } from './refresh-gate';
import { TabOverlay } from './tab-overlay';

/**
 * The sidebar's view of Chrome for one window. Reads come straight from Chrome;
 * every write is a command run by the service worker. Each action applies an
 * optimistic update first, then resolves once the store shows Chrome's real state.
 */
export class ChromeSidebarStore implements SidebarStore {
  // Raw state: replaced, never mutated. A refresh keeps the objects that didn't change (see reuse.ts).
  spaces = $state.raw<Space[]>(EMPTY_STATE.spaces);
  favorites = $state.raw<Favorite[]>(EMPTY_STATE.favorites);
  tabs = $state.raw<ReadonlyMap<TabId, LiveTab>>(EMPTY_STATE.tabs);
  activeSpaceId = $state<SpaceId>(EMPTY_STATE.activeSpaceId);
  activeTabId = $state<TabId | undefined>(EMPTY_STATE.activeTabId);
  openFolders = $state.raw<ReadonlySet<string>>(EMPTY_STATE.openFolders);
  /** A display setting, followed from Volet's settings as they change; no reload needed. */
  collapsedFoldersShowOpenTabs = $state(DEFAULT_SETTINGS.collapsedFoldersShowOpenTabs);

  readonly windowId: number;
  #gate: RefreshGate<SidebarState>;
  #overlay = new TabOverlay();
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(windowId: number) {
    this.windowId = windowId;
    this.#gate = new RefreshGate(
      async () => derive(await loadSnapshot(windowId)),
      (state) => this.#apply(state),
    );
  }

  /** Load the initial state and start following Chrome. */
  async start(): Promise<void> {
    const showSettings = (stored: Parameters<typeof completeSettings>[0]) => {
      this.collapsedFoldersShowOpenTabs = completeSettings(stored).collapsedFoldersShowOpenTabs;
    };
    settingsItem.watch(showSettings);
    void settingsItem.getValue().then(showSettings).catch(() => undefined);
    watchWindow(this.windowId, {
      onChange: () => this.#scheduleRefresh(),
      onTabUpdated: (tabId, change, live) => {
        this.#overlay.record(tabId, change);
        if (live) this.tabs = this.#overlay.patch(this.tabs, tabId);
      },
      onTabRemoved: (tabId) => this.#overlay.forget(tabId),
    });
    await this.#gate.request();
    // Let the service worker tidy this window (and create the bookmark folders on first run).
    void sayHello(this.windowId)
      .catch(() => undefined)
      .then(() => this.#scheduleRefresh());
  }

  #scheduleRefresh(): void {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => void this.#gate.request(), 16);
  }

  #apply(state: SidebarState): void {
    // Event values win over a lagging tabs.query (see TabOverlay). Whatever didn't change keeps
    // its object, so the rows showing it have nothing to do.
    const next = reuseContent(this, { ...state, tabs: this.#overlay.apply(state.tabs) });
    this.spaces = next.spaces;
    this.favorites = next.favorites;
    this.tabs = next.tabs;
    this.activeSpaceId = next.activeSpaceId;
    this.activeTabId = next.activeTabId;
    this.openFolders = next.openFolders;
  }

  /** Apply `optimistic` now, run the command, and resolve once Chrome's state is shown. */
  async #run(command: Command, optimistic?: () => void): Promise<unknown> {
    let value: unknown;
    try {
      value = await this.#gate.during(() => {
        optimistic?.();
        return sendCommand(command);
      });
    } catch (error) {
      console.error(`Command ${command.type} failed:`, error);
    }
    await this.#gate.settled();
    return value;
  }

  /** Like `#run`, for commands that create something: resolves to its id. */
  async #create(command: Command, optimistic?: () => void): Promise<string | undefined> {
    const id = await this.#run(command, optimistic);
    return typeof id === 'string' ? id : undefined;
  }

  #show({ spaces, favorites }: tree.SpacesAndFavorites): void {
    this.spaces = spaces;
    this.favorites = favorites;
  }

  // ───────────────────────────── tabs ─────────────────────────────

  async activateTab(tabId: TabId) {
    await this.#run({ type: 'activateTab', tabId }, () => (this.activeTabId = tabId));
  }

  async closeTab(tabId: TabId) {
    await this.#run({ type: 'closeTab', windowId: this.windowId, tabId }, () => {
      this.spaces = tree.withoutTab(this.spaces, tabId);
    });
  }

  async toggleMute(tabId: TabId) {
    await this.#run({ type: 'toggleMute', tabId });
  }

  async newTab() {
    await this.#run({ type: 'newTab', windowId: this.windowId, spaceId: this.activeSpaceId });
  }

  async clearTemporary(spaceId: SpaceId) {
    await this.#run({ type: 'clearTemporary', windowId: this.windowId, spaceId }, () => {
      this.spaces = tree.withTemporaryCleared(this.spaces, spaceId, this.activeTabId);
    });
  }

  async moveTab(tabId: TabId, spaceId: SpaceId, index?: number) {
    await this.#run({ type: 'moveTab', windowId: this.windowId, tabId, spaceId, index }, () => {
      this.#show(tree.moveTab(this, tabId, spaceId, index));
    });
  }

  // ───────────────────────────── pins and folders ─────────────────────────────

  async openPin(pinId: string) {
    const tabId = tree.findPin(this.spaces, pinId)?.tabId;
    await this.#run({ type: 'openPin', windowId: this.windowId, pinId }, () => {
      if (tabId !== undefined) this.activeTabId = tabId;
    });
  }

  async unloadPin(pinId: string) {
    await this.#run({ type: 'unloadPin', windowId: this.windowId, pinId }, () => {
      this.spaces = tree.withPinTab(this.spaces, pinId, undefined);
    });
  }

  async resetPin(pinId: string) {
    await this.#run({ type: 'resetPin', windowId: this.windowId, pinId });
  }

  async setPinHome(pinId: string) {
    await this.#run({ type: 'setHome', windowId: this.windowId, id: pinId });
  }

  async pinTab(tabId: TabId, parentId: string, index?: number) {
    const tab = this.tabs.get(tabId);
    await this.#run({ type: 'pinTab', windowId: this.windowId, tabId, parentId, index }, () => {
      if (tab) this.#show(tree.pinTab(this, tab, `pending-${tabId}`, parentId, index));
    });
  }

  async unpin(pinId: string, spaceId: SpaceId, index?: number) {
    await this.#run({ type: 'unpin', windowId: this.windowId, pinId, spaceId, index }, () => {
      this.spaces = tree.unpinNode(this.spaces, pinId, spaceId, index);
    });
  }

  async moveNode(id: string, parentId: string, index?: number) {
    await this.#run({ type: 'moveBookmark', id, parentId, index }, () => {
      this.spaces = tree.moveNode(this.spaces, id, parentId, index);
    });
  }

  async renameNode(id: string, title: string) {
    await this.#run({ type: 'renameBookmark', id, title }, () => {
      this.spaces = tree.renameNode(this.spaces, id, title);
    });
  }

  async deleteNode(id: string) {
    await this.#run({ type: 'deleteBookmark', windowId: this.windowId, id }, () => {
      this.spaces = tree.deleteNode(this.spaces, id);
    });
  }

  createFolder(parentId: string) {
    return this.#create({ type: 'createFolder', parentId, index: 0, title: tree.NEW_FOLDER_TITLE });
  }

  createFolderWith(items: SpaceItem[], parentId: string, index?: number) {
    const title = tree.NEW_FOLDER_TITLE;
    return this.#create({ type: 'createFolderWith', windowId: this.windowId, parentId, index, title, items }, () => {
      const folder: Folder = { kind: 'folder', id: 'pending-folder', title, children: [] };
      // It starts open (the engine records it so), and so does its stand-in.
      this.openFolders = tree.including(this.openFolders, folder.id);
      this.#show(tree.folderWith(this, folder, parentId, index, items, this.tabs, (tabId) => `pending-${tabId}`));
    });
  }

  async toggleFolder(folderId: string) {
    this.openFolders = tree.toggled(this.openFolders, folderId);
    // Purely visual state: written directly, no need for the service worker.
    await openFoldersItem.setValue([...this.openFolders]);
  }

  // ───────────────────────────── favorites ─────────────────────────────

  async openFavorite(favoriteId: string) {
    const tabId = this.favorites.find((favorite) => favorite.id === favoriteId)?.tabId;
    await this.#run({ type: 'openFavorite', windowId: this.windowId, favoriteId }, () => {
      if (tabId !== undefined) this.activeTabId = tabId;
    });
  }

  async addFavorite(tabId: TabId, index?: number) {
    const tab = this.tabs.get(tabId);
    await this.#run({ type: 'addFavorite', windowId: this.windowId, tabId, index }, () => {
      if (tab) this.#show(tree.favoriteTab(this, tab, `pending-${tabId}`, index));
    });
  }

  async favoritePin(pinId: string, index?: number) {
    await this.#run({ type: 'favoritePin', windowId: this.windowId, pinId, index }, () => {
      this.#show(tree.pinToFavorite(this.spaces, this.favorites, pinId, index));
    });
  }

  async moveFavorite(favoriteId: string, index: number) {
    await this.#run({ type: 'moveFavorite', favoriteId, index }, () => {
      this.favorites = tree.moveItem(this.favorites, (favorite) => favorite.id === favoriteId, index);
    });
  }

  async removeFavorite(favoriteId: string) {
    await this.#run({ type: 'removeFavorite', windowId: this.windowId, favoriteId }, () => {
      this.#show(tree.removeFavorite(this, favoriteId, this.activeSpaceId));
    });
  }

  async setFavoriteHome(favoriteId: string) {
    await this.#run({ type: 'setHome', windowId: this.windowId, id: favoriteId });
  }

  // ───────────────────────────── Spaces ─────────────────────────────

  async switchSpace(spaceId: SpaceId) {
    if (spaceId === this.activeSpaceId) return;
    await this.#run({ type: 'switchSpace', windowId: this.windowId, spaceId }, () => (this.activeSpaceId = spaceId));
  }

  async createSpace() {
    await this.#run({ type: 'createSpace', windowId: this.windowId });
  }

  async renameSpace(spaceId: SpaceId, name: string) {
    await this.#run({ type: 'renameSpace', spaceId, name }, () => {
      this.spaces = tree.updateSpace(this.spaces, spaceId, { name });
    });
  }

  async setSpaceHue(spaceId: SpaceId, hue: number) {
    await this.#run({ type: 'setSpaceHue', spaceId, hue }, () => {
      this.spaces = tree.updateSpace(this.spaces, spaceId, { hue });
    });
  }

  async moveSpace(spaceId: SpaceId, index: number) {
    await this.#run({ type: 'moveSpace', spaceId, index }, () => {
      this.spaces = tree.moveItem(this.spaces, (space) => space.id === spaceId, index);
    });
  }

  async deleteSpace(spaceId: SpaceId) {
    await this.#run({ type: 'deleteSpace', windowId: this.windowId, spaceId }, () => {
      const { spaces, successor } = tree.deleteSpace(this.spaces, spaceId);
      this.spaces = spaces;
      if (this.activeSpaceId === spaceId) this.activeSpaceId = successor?.id ?? '';
    });
  }

  // ───────────────────────────── pages ─────────────────────────────

  /** Settings open in a tab: nothing the panel shows changes, so there's no refresh to wait for. */
  async openSettings() {
    await sendCommand({ type: 'openSettings' })
      .catch((error: unknown) => console.error('Command openSettings failed:', error));
  }
}
