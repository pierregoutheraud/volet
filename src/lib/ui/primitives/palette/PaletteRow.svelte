<script lang="ts">
  import { Download, Eraser, FolderPlus, Plus, Search, Settings } from '@lucide/svelte';
  import type { PaletteItem } from '@/lib/model/palette';
  import Favicon from '../Favicon.svelte';

  interface Props {
    item: PaletteItem;
    id: string;
    selected: boolean;
    onpick: () => void;
    onhover: () => void;
  }

  let { item, id, selected, onpick, onhover }: Props = $props();

  const KIND_LABEL: Partial<Record<PaletteItem['kind'], string>> = {
    tab: 'Tab',
    pin: 'Pinned',
    favorite: 'Favorite',
    archived: 'Archived',
    space: 'Volet',
  };
  const ACTION_ICON = {
    'new-tab': Plus,
    'new-space': FolderPlus,
    'clear-tabs': Eraser,
    settings: Settings,
    'import-arc': Download,
  } as const;
  const ActionIcon = $derived(
    item.kind === 'action' ? ACTION_ICON[item.ref as keyof typeof ACTION_ICON] : item.kind === 'search' ? Search : undefined,
  );
</script>

<!-- One option in the palette's listbox; the input keeps focus (aria-activedescendant). -->
<div
  {id}
  role="option"
  tabindex="-1"
  aria-selected={selected}
  class={['flex h-10 items-center gap-3 rounded-lg px-3', selected && 'bg-hover']}
  onclick={onpick}
  onkeydown={(event) => event.key === 'Enter' && onpick()}
  onmousemove={onhover}
>
  <span class="grid size-4 flex-none place-items-center text-ink-muted">
    {#if item.kind === 'space'}
      <span class="block size-2.5 rounded-full" style:background="oklch(var(--dot-l) var(--dot-c) {item.hue})"></span>
    {:else if ActionIcon}
      <ActionIcon size={15} strokeWidth={2} />
    {:else if item.url}
      <Favicon url={item.url} icon={item.icon} />
    {/if}
  </span>
  <span class="min-w-0 flex-1 truncate text-[13px]">
    {item.title}
    {#if item.detail}<span class="ml-1.5 text-[12px] text-ink-muted">{item.detail}</span>{/if}
  </span>
  {#if KIND_LABEL[item.kind]}
    <span class="flex-none text-[11px] font-medium text-ink-muted">{KIND_LABEL[item.kind]}</span>
  {/if}
</div>
