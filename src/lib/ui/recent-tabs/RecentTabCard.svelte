<script lang="ts">
  import type { RecentTab } from '@/lib/model/recent-tabs';
  import { X } from '@lucide/svelte';
  import Favicon from '../primitives/Favicon.svelte';

  let { tab, selected, onchoose, onhighlight, onclose }: {
    tab: RecentTab;
    selected: boolean;
    onchoose: () => void;
    onhighlight: () => void;
    onclose: () => void;
  } = $props();

  const sources = $derived(tab.icon ? [tab.icon] : []);

  /** On a Mac, a click with Control held (the switcher's default modifier) is a right-click, and no click follows. */
  const controlClick = (action: () => void) => (event: MouseEvent) => {
    if (!event.ctrlKey || event.button !== 0) return;
    event.preventDefault();
    action();
  };
</script>

<!-- 170 by 106 pixels screenshots plus the card's padding, shrinking on narrower pages (the Volet panel takes room). -->
<div class="group relative w-[186px] min-w-30">
  <!-- Rounded like the panel's rows: hovered like a row, selected with the Volet's tint, like selected rows. -->
  <button
    class={['w-full rounded-[10px] p-2 text-left transition-colors duration-100',
      selected ? 'bg-selected' : 'hover:bg-hover']}
    data-recent-tab
    aria-label={tab.title}
    aria-current={selected ? 'true' : undefined}
    onclick={onchoose}
    oncontextmenu={controlClick(onchoose)}
    onpointermove={onhighlight}
    onfocus={onhighlight}
  >
    <div class="aspect-[16/10] overflow-hidden rounded-lg bg-hover [box-shadow:0_0_0_0.5px_var(--rule)]" data-recent-tab-preview>
      {#if tab.preview}
        <img class="block size-full object-cover" data-recent-tab-screenshot src={tab.preview} alt="" draggable="false" />
      {:else}
        <!-- No screenshot yet: the favicon on a pill, like the panel's active row. -->
        <div class="grid size-full place-items-center" data-recent-tab-placeholder aria-hidden="true">
          <span class="grid size-10 place-items-center rounded-[10px] bg-pill [box-shadow:var(--pill-shadow)]">
            <Favicon url={tab.url} size={24} {sources} />
          </span>
        </div>
      {/if}
    </div>
    <span class="mt-2 flex h-4.5 min-w-0 items-center gap-2" data-recent-tab-caption>
      <Favicon url={tab.url} size={16} {sources} />
      <span class="truncate">{tab.title}</span>
    </span>
  </button>
  <!-- The panel's row buttons, on a chip so they read over a screenshot: on the selected card, or under the pointer. -->
  <button
    class={['absolute top-3 right-3 grid size-6 place-items-center rounded-[7px] bg-(--menu)',
      'text-ink-muted transition-[opacity,color] duration-100 *:pointer-events-none hover:text-ink',
      'focus-visible:outline-offset-1 [box-shadow:var(--pill-shadow)]',
      !selected && ['pointer-events-none opacity-0 group-focus-within:pointer-events-auto group-focus-within:opacity-100',
        'group-hover:pointer-events-auto group-hover:opacity-100']]}
    data-recent-tab-close
    aria-label={`Close ${tab.title}`}
    tabindex={selected ? 0 : -1}
    onclick={onclose}
    oncontextmenu={controlClick(onclose)}
    onpointermove={onhighlight}
    onfocus={onhighlight}
  ><X size={13} strokeWidth={2} /></button>
</div>
