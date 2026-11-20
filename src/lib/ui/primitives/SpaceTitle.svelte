<script lang="ts">
  import { ChevronRight } from '@lucide/svelte';
  import type { Snippet } from 'svelte';
  import { prefersReducedMotion } from 'svelte/motion';

  interface Props {
    name: string;
    /** The Space's pinned tabs are collapsed: the caret points right. */
    collapsed: boolean;
    /** Collapses or shows the pinned tabs (a click on the name; renaming is in the Space's menu). */
    ontoggle: () => void;
    /** Replaces the name with an editor (e.g. a rename field). */
    editor?: Snippet;
  }

  let { name, collapsed, ontoggle, editor }: Props = $props();
</script>

<!-- 4px below, plus the 2px strip the list starts with (where a drop line before its first row shows). -->
<h2 class="group/title pt-1 pr-2.5 pl-1 pb-1 font-display text-[19px] leading-tight font-bold tracking-[-0.01em]">
  {#if editor}
    {@render editor()}
  {:else}
    <!-- The caret before the name says what a click does: fold the pinned tabs away, or bring them back. -->
    <button
      type="button"
      class="flex w-full min-w-0 items-center gap-1.5 rounded-md text-left"
      aria-expanded={!collapsed}
      onclick={ontoggle}
    >
      <ChevronRight
        size={15}
        strokeWidth={2.25}
        aria-hidden="true"
        class={[
          'pointer-events-none flex-none text-ink-muted group-hover/title:text-ink',
          'group-data-hovered/title:text-ink',
          !prefersReducedMotion.current && 'transition-transform duration-150',
          !collapsed && 'rotate-90',
        ]}
      />
      <span class="truncate">{name}</span>
    </button>
  {/if}
</h2>
