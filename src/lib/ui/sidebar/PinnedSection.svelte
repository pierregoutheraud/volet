<script lang="ts">
  import { getSidebar } from '@/lib/model/context';
  import type { Space } from '@/lib/model/types';
  import DropHint from '../primitives/DropHint.svelte';
  import PinnedList from './PinnedList.svelte';

  let { space }: { space: Space } = $props();

  const sidebar = getSidebar();
</script>

<!--
  The strip below the last pin (above the divider) drops at the end, even after an open folder.
  The strip above the first pin is the gap other rows have above them: the line before the first pin
  shows there (the page scrolls, so anything drawn above its top would be cut off).
  Empty, the hint is the drop target: the same spaces are margins, so the list lights up just the hint.
  Collapsed from the Space's name, the list folds like a collapsed folder: only pins with an open tab stay (a setting).
-->
<PinnedList
  parentId={space.id}
  nodes={space.pinned}
  folded={sidebar.collapsedPins.has(space.id)}
  class={space.pinned.length ? 'pt-0.5 pb-2' : 'mt-0.5 mb-2'}
>
  {#snippet empty()}
    <DropHint>Drag tabs here to pin them to {space.name}.</DropHint>
  {/snippet}
</PinnedList>
