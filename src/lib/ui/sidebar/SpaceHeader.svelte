<script lang="ts">
  import type { Space } from '@/lib/model/types';
  import ContextMenu from '../primitives/menu/ContextMenu.svelte';
  import RenameField from '../primitives/RenameField.svelte';
  import SpaceTitle from '../primitives/SpaceTitle.svelte';
  import { spaceKey } from './editing/rename-state.svelte';
  import { getMenuContext } from './menus/menu-context';
  import { spaceMenu } from './menus/space-menu';

  let { space }: { space: Space } = $props();

  const menus = getMenuContext();
  const { store: sidebar, rename } = menus;
  const key = $derived(spaceKey(space.id));
</script>

{#snippet editor()}
  <RenameField
    value={space.name}
    label="Volet name"
    oncommit={(name) => {
      rename.stop();
      void sidebar.renameSpace(space.id, name);
    }}
    oncancel={() => rename.stop()}
  />
{/snippet}

<ContextMenu items={() => spaceMenu(space, menus)}>
  <SpaceTitle
    name={space.name}
    collapsed={sidebar.collapsedPins.has(space.id)}
    ontoggle={() => void sidebar.togglePins(space.id)}
    editor={rename.is(key) ? editor : undefined}
  />
</ContextMenu>
