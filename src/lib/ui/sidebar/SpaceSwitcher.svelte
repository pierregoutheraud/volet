<script lang="ts">
  import { Plus, Search, Settings } from '@lucide/svelte';
  import { getArcClient } from '@/lib/model/arc';
  import { getSidebar } from '@/lib/model/context';
  import { spaceInitial } from '@/lib/model/initial';
  import IconButton from '../primitives/IconButton.svelte';
  import ContextMenu from '../primitives/menu/ContextMenu.svelte';
  import DropdownMenu from '../primitives/menu/DropdownMenu.svelte';
  import { reveal, scrollStrip } from '../primitives/scroll-strip';
  import SpaceDot from '../primitives/SpaceDot.svelte';
  import Tooltip from '../primitives/tooltip/Tooltip.svelte';
  import TooltipGroup from '../primitives/tooltip/TooltipGroup.svelte';
  import { getDrag, getSpaceOrder } from './drag/context';
  import SortableSpaceDot from './drag/SortableSpaceDot.svelte';
  import { getHuePreview } from './hue-preview.svelte';
  import { getMenuContext } from './menus/menu-context';
  import { newVoletMenu } from './menus/new-volet-menu';
  import { spaceMenu } from './menus/space-menu';
  import { getPanelPalette } from './palette/panel-palette-state.svelte';

  const sidebar = getSidebar();
  const menus = getMenuContext();
  const palette = getPanelPalette();
  const order = getSpaceOrder();
  const drag = getDrag();
  const arc = getArcClient();
  const huePreview = getHuePreview();

  /** The open shutter: the active Space's, except mid-drag (see `DragState.startSpaceId`). */
  const openSpaceId = $derived(drag.startSpaceId ?? sidebar.activeSpaceId);

  /**
   * Keeps the active Space's shutter in view: at once when the panel opens, then gliding. It is
   * still opening when first measured, so it's brought into view again once it has opened.
   */
  let shown = false;
  function showActive(node: HTMLElement) {
    const active = `[data-space-dot="${CSS.escape(sidebar.activeSpaceId)}"]`;
    const cleanup = reveal(node, active, shown);
    shown = true;
    const opened = (event: TransitionEvent) => {
      if (event.propertyName === 'width' && (event.target as Element).closest(active)) reveal(node, active);
    };
    node.addEventListener('transitionend', opened);
    return () => {
      cleanup();
      node.removeEventListener('transitionend', opened);
    };
  }
</script>

<nav class="flex h-11 flex-none items-center gap-2 px-2.5" aria-label="Volets">
  <!-- Tools for all of Volet, Search in the corner. The shutters center in the room left between them and New Volet.
       The buttons touch, so their tooltip glides from one to the other. -->
  <TooltipGroup>
    <div class="flex flex-none">
      {#if palette}
        <IconButton label="Search tabs and pins (⌘K)" onclick={() => palette.show()}>
          <Search size={15} strokeWidth={2} />
        </IconButton>
      {/if}
      <IconButton label="Settings" onclick={() => sidebar.openSettings()}>
        <Settings size={15} strokeWidth={2} />
      </IconButton>
    </div>
  </TooltipGroup>

  <!-- One tooltip for all the shutters: it glides to the hovered one. They touch (no gap)
       so the pointer goes straight from one to the next and the tooltip never closes between.
       Closed shutters take a slot, narrowing from 26px to 20px to fit next to the open one
       (up to 92px); past that, the row scrolls. -->
  <TooltipGroup>
    <ul
      class="scroll-strip flex h-full min-w-0 flex-1 items-center justify-center-safe overflow-x-auto [container-type:inline-size] *:min-w-(--slot) *:flex-none"
      style:--dots={sidebar.spaces.length}
      style:--slot="clamp(20px, calc((100cqi - 92px) / max(var(--dots) - 1, 1)), 26px)"
      {@attach scrollStrip}
      {@attach showActive}
    >
      <!-- Drag a shutter to reorder the Spaces; drop a tab on one to move it there. -->
      {#each order.ordered(sidebar.spaces) as space, index (space.id)}
        <SortableSpaceDot spaceId={space.id} {index}>
          {#snippet children({ highlighted, handle })}
            <ContextMenu items={() => spaceMenu(space, menus)}>
              <Tooltip label={space.name}>
                {#snippet trigger(props)}
                  <SpaceDot
                    {...props}
                    data-space-dot={space.id}
                    name={space.name}
                    initial={spaceInitial(space.name)}
                    hue={huePreview.hueOf(space)}
                    active={space.id === sidebar.activeSpaceId}
                    open={space.id === openSpaceId}
                    {highlighted}
                    {handle}
                    onclick={() => sidebar.switchSpace(space.id)}
                  />
                {/snippet}
              </Tooltip>
            </ContextMenu>
          {/snippet}
        </SortableSpaceDot>
      {/each}
    </ul>
  </TooltipGroup>

  <div class="w-6 flex-none">
    <!-- While Arc Spaces are left to import, the button offers them next to a blank Volet. -->
    {#if arc?.offers.length}
      <DropdownMenu items={() => newVoletMenu(sidebar, arc)}>
        {#snippet trigger(props)}
          <IconButton {...props} label="New Volet">
            <Plus size={16} strokeWidth={2} />
          </IconButton>
        {/snippet}
      </DropdownMenu>
    {:else}
      <IconButton label="New Volet" onclick={() => sidebar.createSpace()}>
        <Plus size={16} strokeWidth={2} />
      </IconButton>
    {/if}
  </div>
</nav>
