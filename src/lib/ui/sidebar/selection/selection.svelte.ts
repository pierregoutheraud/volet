import { createContext } from 'svelte';
import { type DndLookup, type Entry, entryKey, keySet } from '@/lib/model/dnd';
import { activeEntry, between, outermost, pageEntries } from '@/lib/model/selection';
import type { SidebarStore, SpaceId, SpaceItem } from '@/lib/model/types';
import { createLookup } from '@/lib/state/lookup';

/**
 * The selected rows of the active Space, following Chrome's tab strip: Shift+click selects
 * from the last clicked row (or the current tab), Cmd or Ctrl+click adds or removes a row
 * (starting from the current tab). A selection belongs to its Space: it is empty on the others.
 */
export class Selection {
  #store: SidebarStore;
  #lookup: DndLookup;
  /** Entry keys, replaced wholesale on every change (a selection is a handful of rows). */
  #keys = $state.raw<ReadonlySet<string>>(keySet([]));
  #spaceId = $state<SpaceId | undefined>();
  /** Where Shift+click ranges start. Nothing renders it, so it isn't reactive. */
  #anchor: SpaceItem | undefined;

  constructor(store: SidebarStore) {
    this.#store = store;
    this.#lookup = createLookup(store);
  }

  #space = $derived.by(() => this.#store.spaces.find((space) => space.id === this.#store.activeSpaceId));

  /** The selected rows still on the page, top to bottom. */
  readonly entries = $derived.by((): SpaceItem[] => {
    const space = this.#space;
    if (!space || space.id !== this.#spaceId || this.#keys.size === 0) return [];
    return pageEntries(space).filter((entry) => this.#keys.has(entryKey(entry)));
  });

  /** Every row asks whether it's selected: a set answers at once. */
  #shown = $derived(keySet(this.entries));

  get size(): number {
    return this.entries.length;
  }

  has(entry: Entry): boolean {
    return this.#shown.has(entryKey(entry));
  }

  /** Several rows are selected, `entry` among them: acting on it acts on all of them. */
  inGroup(entry: Entry): boolean {
    return this.size > 1 && this.has(entry);
  }

  /** What acting on the selection acts on: its rows, minus those inside a selected folder. */
  group(): SpaceItem[] {
    return outermost(this.entries, this.#lookup);
  }

  /**
   * Handle a click on a row. Returns true when it was a selection gesture (Shift, Cmd or
   * Ctrl), and the row must not activate. A plain click clears the selection.
   */
  click(entry: SpaceItem, event: MouseEvent): boolean {
    const space = this.#space;
    if (!space) return false;
    const { openFolders, collapsedFoldersShowOpenTabs, activeTabId } = this.#store;
    const current = activeEntry(space, activeTabId);
    if (event.shiftKey) {
      const order = pageEntries(space, openFolders, collapsedFoldersShowOpenTabs);
      const onPage = (candidate: SpaceItem | undefined) =>
        candidate && order.some((other) => entryKey(other) === entryKey(candidate)) ? candidate : undefined;
      const anchor = onPage(this.#anchor) ?? onPage(current) ?? entry;
      this.#anchor = anchor;
      this.#select(space.id, between(order, anchor, entry));
      return true;
    }
    if (event.metaKey || event.ctrlKey) {
      // Nothing selected yet: start from the current tab (unless that's the row clicked).
      const fromCurrent = current && entryKey(current) !== entryKey(entry) ? [current] : [];
      const base = this.size > 0 ? this.entries : fromCurrent;
      const key = entryKey(entry);
      const chosen = base.some((other) => entryKey(other) === key)
        ? base.filter((other) => entryKey(other) !== key)
        : [...base, entry];
      this.#anchor = entry;
      this.#select(space.id, chosen);
      return true;
    }
    this.clear();
    this.#anchor = entry;
    return false;
  }

  clear(): void {
    if (this.#keys.size > 0) this.#keys = keySet([]);
  }

  #select(spaceId: SpaceId, entries: SpaceItem[]): void {
    this.#spaceId = spaceId;
    this.#keys = keySet(entries);
  }
}

export const [getSelection, setSelection] = createContext<Selection>();
