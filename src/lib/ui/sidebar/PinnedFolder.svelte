<script lang="ts">
  import type { Attachment } from 'svelte/attachments';
  import { prefersReducedMotion } from 'svelte/motion';
  import { slide } from 'svelte/transition';
  import type { Folder, SpaceItem } from '@/lib/model/types';
  import FolderRow from '../primitives/FolderRow.svelte';
  import ContextMenu from '../primitives/menu/ContextMenu.svelte';
  import RenameField from '../primitives/RenameField.svelte';
  import { getDrag } from './drag/context';
  import { folderMenu } from './menus/folder-menu';
  import { getMenuContext } from './menus/menu-context';
  import { rowMenu } from './menus/selection-menu';
  import PinnedList from './PinnedList.svelte';

  interface Props {
    folder: Folder;
    depth?: number;
    /** Inside a collapsed folder: the row hides, and only its pins with an open tab stay (or none, a setting). */
    folded?: boolean;
    handle?: Attachment<HTMLElement>;
  }

  let { folder, depth = 0, folded = false, handle }: Props = $props();

  const menus = getMenuContext();
  const drag = getDrag();
  const { store: sidebar, rename, selection } = menus;
  const entry = $derived<SpaceItem>({ kind: 'node', id: folder.id });
  const open = $derived(sidebar.openFolders.has(folder.id));
  const duration = $derived(prefersReducedMotion.current ? 0 : 160);
</script>

{#snippet editor()}
  <RenameField
    value={folder.title}
    label="Folder name"
    oncommit={(title) => {
      rename.stop();
      void sidebar.renameNode(folder.id, title);
    }}
    oncancel={() => rename.stop()}
  />
{/snippet}

{#if !folded}
  <div transition:slide={{ duration }}>
    <ContextMenu items={() => rowMenu(entry, menus, () => folderMenu(folder, menus))}>
      <FolderRow
        title={folder.title}
        {open}
        selected={selection.has(entry)}
        dropTarget={drag.isInto(folder.id)}
        {depth}
        {handle}
        editor={rename.is(folder.id) ? editor : undefined}
        ontoggle={(event) => {
          if (!selection.click(entry, event)) sidebar.toggleFolder(folder.id);
        }}
      />
    </ContextMenu>
  </div>
{/if}
<!-- Collapsed, the folder still shows its pins whose tab is open (Arc shows the tab you're on), unless Volet's
     settings say to hide those too (`collapsedFoldersShowOpenTabs`). -->
<PinnedList parentId={folder.id} nodes={folder.children} depth={depth + 1} folded={folded || !open}>
  {#snippet empty()}
    <p class="py-1.5 pl-[calc(36px+var(--depth)*16px)] text-[12px] text-ink-muted" style:--depth={depth}>
      Empty folder
    </p>
  {/snippet}
</PinnedList>
