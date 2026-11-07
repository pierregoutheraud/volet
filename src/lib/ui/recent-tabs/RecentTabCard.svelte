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
</script>

<div class="recent-tab-card" data-selected={selected}>
  <button
    class="recent-tab"
    aria-label={tab.title}
    aria-current={selected ? 'true' : undefined}
    data-selected={selected}
    onclick={onchoose}
    onpointermove={onhighlight}
    onfocus={onhighlight}
  >
    <div class="recent-tab-preview">
      {#if tab.preview}
        <img class="recent-tab-screenshot" src={tab.preview} alt="" draggable="false" />
      {:else}
        <div class="recent-tab-placeholder" aria-hidden="true">
          <span class="recent-tab-placeholder-icon"><Favicon url={tab.url} size={28} {sources} /></span>
        </div>
      {/if}
    </div>
    <span class="recent-tab-caption">
      <Favicon url={tab.url} size={14} {sources} />
      <span class="recent-tab-title">{tab.title}</span>
    </span>
  </button>
  <button
    class="recent-tab-close"
    aria-label={`Close ${tab.title}`}
    tabindex={selected ? 0 : -1}
    onclick={onclose}
    onpointermove={onhighlight}
    onfocus={onhighlight}
  ><X size={13} strokeWidth={2} /></button>
</div>
