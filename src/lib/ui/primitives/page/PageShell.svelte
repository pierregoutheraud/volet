<script lang="ts">
  import type { Snippet } from 'svelte';
  import { colorScheme } from '../color-scheme';

  interface Props {
    title: string;
    intro?: string;
    children: Snippet;
  }

  let { title, intro, children }: Props = $props();
</script>

<!-- A full-page layout for the extension's own pages, in the sidebar's tint (the default violet: pages aren't tied to a
     Space). -->
<div
  class="page-root min-h-screen bg-[linear-gradient(170deg,var(--wash-top),var(--wash-bottom))] text-ink [--space-hue:268]"
  data-scheme={colorScheme()}
>
  <main class="mx-auto flex max-w-[640px] flex-col gap-5 px-4 py-12">
    <header>
      <h1 class="font-display text-[28px] leading-tight font-bold">{title}</h1>
      {#if intro}<p class="mt-2 text-[14px] leading-relaxed text-ink-muted">{intro}</p>{/if}
    </header>
    {@render children()}
  </main>
  <!-- Lists and menus render here, inside the page's tokens (see OVERLAY_ROOT). -->
  <div data-overlay-root></div>
</div>
