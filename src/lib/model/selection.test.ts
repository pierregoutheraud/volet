import { describe, expect, it } from 'vitest';
import type { DndLookup } from './dnd';
import { activeEntry, between, folderPlace, outermost, pageEntries } from './selection';
import type { PinnedNode, Space } from './types';

const space: Space = {
  id: 's1',
  name: 'Work',
  hue: 0,
  pinned: [
    { kind: 'pin', id: 'p1', title: 'Issues', url: 'https://a', tabId: 7 },
    {
      kind: 'folder',
      id: 'docs',
      title: 'Docs',
      children: [
        { kind: 'pin', id: 'p2', title: 'Wiki', url: 'https://b', tabId: 8 },
        { kind: 'pin', id: 'p3', title: 'RFCs', url: 'https://c' },
      ],
    },
  ],
  tabIds: [1, 2],
};

const node = (id: string) => ({ kind: 'node' as const, id });
const tab = (id: number) => ({ kind: 'tab' as const, id });

const lookup: DndLookup = {
  node: (id): PinnedNode => (id === 'docs' ? space.pinned[1]! : { kind: 'pin', id, title: '', url: '' }),
  favorite: () => undefined,
  contains: (ancestor, id) => ancestor === id || (ancestor === 'docs' && (id === 'p2' || id === 'p3')),
};

describe('pageEntries', () => {
  it('lists pins, open folders with their contents, then temporary tabs', () => {
    expect(pageEntries(space)).toEqual([node('p1'), node('docs'), node('p2'), node('p3'), tab(1), tab(2)]);
  });

  it('shows only the open pins of a collapsed folder', () => {
    expect(pageEntries(space, new Set())).toEqual([node('p1'), node('docs'), node('p2'), tab(1), tab(2)]);
    expect(pageEntries(space, new Set(['docs']))).toEqual(pageEntries(space));
  });

  it('shows nothing inside a collapsed folder when open tabs hide there too', () => {
    expect(pageEntries(space, new Set(), false)).toEqual([node('p1'), node('docs'), tab(1), tab(2)]);
    expect(pageEntries(space, new Set(['docs']), false)).toEqual(pageEntries(space));
  });
});

describe('activeEntry', () => {
  it('finds the row showing the active tab: a temporary tab or a pin', () => {
    expect(activeEntry(space, 2)).toEqual(tab(2));
    expect(activeEntry(space, 8)).toEqual(node('p2'));
    expect(activeEntry(space, 99)).toBeUndefined();
  });
});

describe('between', () => {
  const order = pageEntries(space);

  it('selects a range either way round', () => {
    expect(between(order, node('p3'), tab(1))).toEqual([node('p3'), tab(1)]);
    expect(between(order, tab(1), node('p3'))).toEqual([node('p3'), tab(1)]);
  });

  it('falls back to the clicked entry when the anchor is gone', () => {
    expect(between(order, tab(42), tab(2))).toEqual([tab(2)]);
  });
});

describe('outermost', () => {
  it('leaves out entries inside a selected folder', () => {
    expect(outermost([node('docs'), node('p2'), tab(1)], lookup)).toEqual([node('docs'), tab(1)]);
  });
});

describe('folderPlace', () => {
  it('puts the folder where its first pinned entry is', () => {
    expect(folderPlace(space, node('p3'))).toEqual({ parentId: 'docs', index: 1 });
    expect(folderPlace(space, node('docs'))).toEqual({ parentId: 's1', index: 1 });
  });

  it('puts a folder of temporary tabs after the pins', () => {
    expect(folderPlace(space, tab(2))).toEqual({ parentId: 's1', index: 2 });
  });
});
