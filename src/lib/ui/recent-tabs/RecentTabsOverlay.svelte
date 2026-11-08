<script lang="ts">
  import { colorScheme } from '../primitives/color-scheme';
  import RecentTabCard from './RecentTabCard.svelte';
  import type { RecentTabsState } from './recent-tabs-state.svelte';

  let { state, onchoose, oncancel, scheme }: {
    state: RecentTabsState;
    onchoose: (index: number) => void;
    oncancel: () => void;
    /** Forces a color scheme; otherwise the system's. */
    scheme?: 'light' | 'dark';
  } = $props();
</script>

{#if state.view}
  <!-- Tinted like the side panel and Search: the window's active Volet's hue, in the system's color scheme. -->
  <div
    class="recent-tabs-root fixed inset-0 z-2147483647 grid place-items-center font-sans text-[13px]/[1.35] antialiased"
    data-scheme={colorScheme(scheme)}
    style:--space-hue={state.hue}
  >
    <!-- No dimming: the switcher is a glance while the shortcut is held, like the macOS switcher. -->
    <button class="absolute inset-0 size-full cursor-default" aria-label="Cancel tab switching" onclick={oncancel}></button>
    <!-- Search's surface. Not modal: a glance while the shortcut is held, the page keeps its focus. -->
    <div
      class="relative w-max max-w-[calc(100vw-32px)] rounded-[14px] bg-(--menu) p-2 [box-shadow:var(--overlay-shadow)]"
      role="dialog"
      aria-label="Recent tabs"
      tabindex="-1"
    >
      <div class="flex gap-0.5 overflow-x-auto [scrollbar-width:none]">
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
      <span class="sr-only" aria-live="polite">{state.view.tabs[state.view.selected]?.title}</span>
    </div>
  </div>
{/if}
