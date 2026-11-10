<script lang="ts">
  import { Tooltip } from 'bits-ui';
  import { type ArcClient, setArcClient } from '@/lib/model/arc';
  import { setSidebar } from '@/lib/model/context';
  import type { PaletteClient } from '@/lib/model/palette';
  import { type RecentTabsLauncher, setRecentTabsLauncher } from '@/lib/model/recent-tabs-launcher';
  import { type SearchLauncher, setSearchLauncher } from '@/lib/model/search-launcher';
  import type { SidebarStore } from '@/lib/model/types';
  import { colorScheme } from '../primitives/color-scheme';
  import { MountQueue } from '../primitives/mount-queue';
  import Pager from '../primitives/Pager.svelte';
  import type { ToastState } from '../toast/toast-state.svelte';
  import ArcInvite from './ArcInvite.svelte';
  import DragLayer from './drag/DragLayer.svelte';
  import ConfirmHost from './editing/ConfirmHost.svelte';
  import { ConfirmState } from './editing/confirm-state.svelte';
  import { setConfirm, setRename } from './editing/context';
  import { RenameState } from './editing/rename-state.svelte';
  import FavoritesGrid from './FavoritesGrid.svelte';
  import { HuePreview, setHuePreview } from './hue-preview.svelte';
  import { setMountQueue } from './mount';
  import PanelSearch from './palette/PanelSearch.svelte';
  import PanelToast from './PanelToast.svelte';
  import SelectionDismiss from './selection/SelectionDismiss.svelte';
  import { Selection, setSelection } from './selection/selection.svelte';
  import SpacePage from './SpacePage.svelte';
  import SpaceSwitcher from './SpaceSwitcher.svelte';
  import { SpaceSwipe } from './space-swipe.svelte';
  import { SpaceTint } from './space-tint.svelte';

  interface Props {
    store: SidebarStore;
    /** Search: the bottom bar's button, ⌘K and "/", over the page in front (or in the panel where it can't show). */
    search?: SearchLauncher;
    /** Search in the panel, where nothing can show over the page. */
    palette?: PaletteClient;
    /** Short confirmations at the panel's top ("Link copied"). */
    toast?: ToastState;
    /** Arc's first-run card and the Arc Spaces offered by the New Volet button. */
    arc?: ArcClient;
    /** The bottom bar's button for the recent tab switcher, which shows over the page in front. */
    recentTabs?: RecentTabsLauncher;
    /** Force a color scheme (the prototype uses this); defaults to the system's. */
    scheme?: 'light' | 'dark';
  }

  let { store, search, palette, toast, arc, recentTabs, scheme }: Props = $props();

  // The store is created once at mount and never replaced.
  // svelte-ignore state_referenced_locally
  const sidebar = setSidebar(store);
  setRename(new RenameState());
  setConfirm(new ConfirmState());
  setSelection(new Selection(sidebar));
  const huePreview = setHuePreview(new HuePreview());
  setMountQueue(new MountQueue());
  // svelte-ignore state_referenced_locally
  setArcClient(arc);
  // svelte-ignore state_referenced_locally
  setRecentTabsLauncher(recentTabs);
  // svelte-ignore state_referenced_locally
  setSearchLauncher(search);

  const activeIndex = $derived(Math.max(0, sidebar.spaces.findIndex((space) => space.id === sidebar.activeSpaceId)));

  const swipe = new SpaceSwipe({
    canGo: (direction) => sidebar.spaces[activeIndex + direction] !== undefined,
    onCommit: (direction) => {
      const target = sidebar.spaces[activeIndex + direction];
      if (target) sidebar.switchSpace(target.id);
    },
  });
  const tint = new SpaceTint({
    spaces: () => sidebar.spaces,
    activeIndex: () => activeIndex,
    swipe,
    hueOf: (space) => huePreview.hueOf(space),
  });
</script>

<!-- The panel's wash. Its hue glides from one Space's color to the next (registered in app.css), except while a swipe
     or a color pick drives it directly. -->
<div
  class={['sidebar @container relative flex h-full flex-col overflow-hidden select-none',
    'bg-[linear-gradient(170deg,var(--wash-top),var(--wash-bottom))] [transition:--space-hue_460ms_cubic-bezier(0.2,0.8,0.2,1)]',
    'data-[swiping=true]:transition-none data-tint-live:transition-none motion-reduce:transition-none']}
  data-scheme={colorScheme(scheme)}
  data-swiping={swipe.dragging}
  data-tint-live={huePreview.active || undefined}
  style:--space-hue={tint.hue}
  bind:clientWidth={swipe.width}
  {@attach swipe.attach}
>
  <!-- Tooltips appear right away and close as soon as the pointer leaves their trigger, so they
       never stand in the way (they fade in and out, see .tooltip-surface). -->
  <Tooltip.Provider delayDuration={0} disableHoverableContent>
    <DragLayer store={sidebar}>
      <FavoritesGrid />
      <Pager
        items={sidebar.spaces}
        {activeIndex}
        offset={swipe.offset}
        dragging={swipe.dragging}
        label={(space) => space.name}
      >
        {#snippet page(space)}
          <SpacePage {space} />
        {/snippet}
      </Pager>
      <ArcInvite />
      <SpaceSwitcher />
      <ConfirmHost />
      <SelectionDismiss />
      {#if search && palette}
        <PanelSearch {search} client={palette} />
      {/if}
      {#if toast}
        <PanelToast {toast} />
      {/if}
    </DragLayer>
  </Tooltip.Provider>
  <!-- Menus, tooltips and dialogs render here, inside the tint. -->
  <div data-overlay-root></div>
</div>
