<script lang="ts">
  import type { Snippet } from 'svelte';
  import { prefersReducedMotion } from 'svelte/motion';
  import { slide } from 'svelte/transition';
  import { type Entry, entryKey, pinsList } from '@/lib/model/dnd';
  import { getSidebar } from '@/lib/model/context';
  import { hasOpenTab } from '@/lib/model/pinned';
  import type { PinnedNode } from '@/lib/model/types';
  import Deferred from '../primitives/Deferred.svelte';
  import { getDrag } from './drag/context';
  import DropZone from './drag/DropZone.svelte';
  import SortableEntry from './drag/SortableEntry.svelte';
  import EntryRow from './EntryRow.svelte';
  import { getMountQueue, hasMountQueue } from './mount';

  interface Props {
    /** The Space (top level) or folder these pins live in. */
    parentId: string;
    nodes: PinnedNode[];
    depth?: number;
    /** Inside a collapsed folder: only the rows with an open tab stay, or none (a setting). */
    folded?: boolean;
    /** Shown when the list is empty. */
    empty?: Snippet;
    /** Classes for the list's drop zone. */
    class?: string;
  }

  let { parentId, nodes, depth = 0, folded = false, empty, class: className }: Props = $props();

  const sidebar = getSidebar();
  const drag = getDrag();
  const mountQueue = hasMountQueue() ? getMountQueue() : undefined;
  const list = $derived(pinsList(parentId));
  const entries = $derived(drag.entries(list, () => nodes.map((node): Entry => ({ kind: 'node', id: node.id }))));
  const duration = $derived(prefersReducedMotion.current ? 0 : 160);
  const byId = $derived(new Map(nodes.map((node) => [node.id, node])));

  /**
   * Folded, a row stays while it has an open tab and the setting keeps those
   * (`collapsedFoldersShowOpenTabs`). Rows dragged in from elsewhere always show.
   */
  function shown(entry: Entry): boolean {
    if (!folded || entry.kind !== 'node') return true;
    const node = byId.get(entry.id);
    return !node || (sidebar.collapsedFoldersShowOpenTabs && hasOpenTab(node));
  }
</script>

<!--
  Collapsing a folder slides away only the rows that leave (local transitions: rows added or
  removed for any other reason just appear). The 2px row gap is each row's top padding, so it
  slides away with the row; a folder's first row takes it as its gap below the folder.
-->
<DropZone {list} {depth} class={className}>
  <ul class="flex flex-col">
    {#each entries as entry, index (entryKey(entry))}
      {#if shown(entry)}
        <li class={depth > 0 ? 'pt-0.5' : 'not-first:pt-0.5'} transition:slide={{ duration }}>
          <!-- A big folder opening mounts its rows over a few frames (see MountQueue). -->
          <Deferred queue={mountQueue} height={34}>
            <SortableEntry tag="div" {entry} {list} {index} {depth}>
              {#snippet children(handle)}
                <EntryRow {entry} {depth} {folded} {handle} />
              {/snippet}
            </SortableEntry>
          </Deferred>
        </li>
      {/if}
    {/each}
  </ul>
  <!--
    The empty hint slides with its folder (collapsing, expanding), but a row arriving or leaving
    swaps with it at once: the first row dropped in lands where the hint was, with no overlap.
  -->
  {#if !folded}
    <div transition:slide={{ duration }}>
      {#if entries.length === 0}{@render empty?.()}{/if}
    </div>
  {/if}
</DropZone>
