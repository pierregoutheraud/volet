<script lang="ts">
  import type { PaletteClient } from '@/lib/model/palette';
  import type { SearchLauncher } from '@/lib/model/search-launcher';
  import PanelPalette from './PanelPalette.svelte';
  import RelayInput from './RelayInput.svelte';

  let { search, client }: { search: SearchLauncher; client: PaletteClient } = $props();

  /** ⌘K / Ctrl+K anywhere in the panel toggles Search; "/" opens it when not typing. */
  function onkeydown(event: KeyboardEvent) {
    const typing = event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable]');
    const modK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
    if (modK || (event.key === '/' && !typing && search.mode === 'closed')) {
      event.preventDefault();
      search.toggle();
    }
  }
</script>

<svelte:window {onkeydown} />

{#if search.mode === 'page'}
  <RelayInput {search} />
{:else if search.mode === 'panel'}
  <PanelPalette {client} onclose={() => search.close()} />
{/if}
