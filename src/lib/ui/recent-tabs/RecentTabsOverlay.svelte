<script lang="ts">
  import RecentTabCard from './RecentTabCard.svelte';
  import type { RecentTabsState } from './recent-tabs-state.svelte';

  let { state, onchoose, oncancel }: {
    state: RecentTabsState;
    onchoose: (index: number) => void;
    oncancel: () => void;
  } = $props();
</script>

{#if state.view}
  <div class="recent-tabs-root">
    <button class="recent-tabs-backdrop" aria-label="Cancel tab switching" onclick={oncancel}></button>
    <div class="recent-tabs-dialog" role="dialog" aria-modal="true" aria-label="Recent tabs" tabindex="-1">
      <div class="recent-tabs-list">
        {#each state.view.tabs as tab, index (tab.id)}
          <RecentTabCard
            {tab}
            selected={index === state.view.selected}
            onhighlight={() => state.cycle.select(index)}
            onchoose={() => onchoose(index)}
            onclose={() => { state.cycle.select(index); state.cycle.closeSelected(); }}
          />
        {/each}
      </div>
      <span class="recent-tabs-announcement" aria-live="polite">{state.view.tabs[state.view.selected]?.title}</span>
    </div>
  </div>
{/if}
