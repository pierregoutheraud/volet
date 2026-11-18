<script lang="ts">
  import type { Attachment } from 'svelte/attachments';
  import { Volume2, VolumeX, X } from '@lucide/svelte';
  import type { LiveTab, SpaceItem } from '@/lib/model/types';
  import IconButton from '../primitives/IconButton.svelte';
  import ContextMenu from '../primitives/menu/ContextMenu.svelte';
  import TabRow from '../primitives/TabRow.svelte';
  import { getMenuContext } from './menus/menu-context';
  import { rowMenu } from './menus/selection-menu';
  import { tabMenu } from './menus/tab-menu';

  let { tab, depth = 0, handle }: { tab: LiveTab; depth?: number; handle?: Attachment<HTMLElement> } = $props();

  const menus = getMenuContext();
  const { store: sidebar, selection } = menus;
  const entry = $derived<SpaceItem>({ kind: 'tab', id: tab.id });
</script>

<ContextMenu items={() => rowMenu(entry, menus, () => tabMenu(tab, menus))}>
  <TabRow
    title={tab.title}
    url={tab.url}
    icon={tab.favIconUrl}
    active={tab.id === sidebar.activeTabId}
    selected={selection.has(entry)}
    loading={tab.status === 'loading'}
    {depth}
    {handle}
    buttons={{ shown: tab.audible ? 1 : 0, onHover: tab.audible ? 2 : 1 }}
    onactivate={(event) => {
      if (!selection.click(entry, event)) sidebar.activateTab(tab.id);
    }}
  >
    {#snippet trailing()}
      {#if tab.audible}
        <IconButton label={tab.muted ? 'Unmute tab' : 'Mute tab'} onclick={() => sidebar.toggleMute(tab.id)}>
          {#if tab.muted}<VolumeX size={14} />{:else}<Volume2 size={14} />{/if}
        </IconButton>
      {/if}
      <!-- While the tab plays sound, its sound button keeps to the row's edge until the row is hovered
           (the title leaves room for one button then: `buttons.shown`). -->
      <IconButton label="Close tab" reveal collapse={tab.audible} onclick={() => sidebar.closeTab(tab.id)}>
        <X size={14} strokeWidth={2.25} />
      </IconButton>
    {/snippet}
  </TabRow>
</ContextMenu>
