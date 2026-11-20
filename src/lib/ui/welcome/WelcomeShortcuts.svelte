<script lang="ts">
  import { type WelcomeClient, welcomeShortcuts } from '@/lib/model/welcome';
  import Kbd from '../primitives/page/Kbd.svelte';

  let { client }: { client: WelcomeClient } = $props();

  const shortcuts = $derived(welcomeShortcuts(client.shortcuts));
</script>

<!-- One row of the shortcuts worth knowing from the start; Settings has them all. -->
{#if shortcuts.length}
  <ul class="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-ink-muted" aria-label="Shortcuts">
    {#each shortcuts as shortcut (shortcut.label)}
      <li class="inline-flex items-center gap-2"><Kbd keys={shortcut.keys} />{shortcut.label}</li>
    {/each}
  </ul>
{/if}
