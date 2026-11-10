import { type DndLookup, type Entry, buildLists, entryKey, locate, parseList } from './dnd';
import { activePinsIn, openPinsIn } from './pinned';
import type { PinnedNode, Space, SpaceItem, TabId } from './types';

/**
 * The entries of a Space's page, top to bottom: pins and folders, then temporary tabs.
 * A folder's contents follow it when it is in `open`; a collapsed folder still shows the pins
 * whose tab is open, unless `openTabsInCollapsed` is off (a setting). Pass no `open` set to list
 * everything.
 */
export function pageEntries(space: Space, open?: ReadonlySet<string>, openTabsInCollapsed = true): SpaceItem[] {
  const walk = (nodes: PinnedNode[]): SpaceItem[] =>
    nodes.flatMap((node): SpaceItem[] => {
      if (node.kind === 'pin') return [{ kind: 'node', id: node.id }];
      const collapsed = open && !open.has(node.id);
      const inside = !collapsed
        ? walk(node.children)
        : openTabsInCollapsed
          ? openPinsIn(node.children).map((pin): SpaceItem => ({ kind: 'node', id: pin.id }))
          : [];
      return [{ kind: 'node', id: node.id }, ...inside];
    });
  return [...walk(space.pinned), ...space.tabIds.map((id): SpaceItem => ({ kind: 'tab', id }))];
}

/** The page entry showing the active tab: a temporary tab or a pin. */
export function activeEntry(space: Space, activeTabId: TabId | undefined): SpaceItem | undefined {
  if (activeTabId === undefined) return undefined;
  if (space.tabIds.includes(activeTabId)) return { kind: 'tab', id: activeTabId };
  const [pin] = activePinsIn(space.pinned, activeTabId);
  return pin && { kind: 'node', id: pin.id };
}

/** The entries from `a` to `b` (either way round) in `order`; just `b` if `a` isn't there. */
export function between<T extends Entry>(order: T[], a: T, b: T): T[] {
  const keys = order.map(entryKey);
  const from = keys.indexOf(entryKey(a));
  const to = keys.indexOf(entryKey(b));
  if (to === -1) return [];
  if (from === -1) return [b];
  return order.slice(Math.min(from, to), Math.max(from, to) + 1);
}

/** Leave out entries inside a folder that is also in the list: moving the folder moves them. */
export function outermost<T extends Entry>(entries: T[], lookup: DndLookup): T[] {
  const folders = entries.flatMap((entry) =>
    entry.kind === 'node' && lookup.node(entry.id)?.kind === 'folder' ? [entry.id] : [],
  );
  return entries.filter(
    (entry) =>
      entry.kind !== 'node' || !folders.some((folder) => folder !== entry.id && lookup.contains(folder, entry.id)),
  );
}

/**
 * Where a folder made from some entries goes: where `first` (the topmost of them) is when
 * it is pinned, otherwise at the end of the Space's pins.
 */
export function folderPlace(space: Space, first: SpaceItem): { parentId: string; index: number } {
  const at = locate(buildLists([space], []), first);
  const list = at && parseList(at.list);
  if (at && list?.kind === 'pins') return { parentId: list.id, index: at.index };
  return { parentId: space.id, index: space.pinned.length };
}
