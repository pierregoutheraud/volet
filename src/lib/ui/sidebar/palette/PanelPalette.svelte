<script lang="ts">
  import type { PaletteClient } from '@/lib/model/palette';
  import PaletteBox from '../../palette/PaletteBox.svelte';
  import { PaletteState } from '../../palette/palette-state.svelte';

  let { client, onclose }: { client: PaletteClient; onclose: () => void } = $props();

  // A new Search each time it shows.
  // svelte-ignore state_referenced_locally
  const palette = new PaletteState(client);
</script>

<!-- Search in the panel, only where nothing can show over the page: Chrome's own pages, the Web Store, a site Volet
     can't access. -->
<div class="absolute inset-0 z-40 flex flex-col p-2.5" role="dialog" aria-modal="true" aria-label="Search">
  <div class="absolute inset-0 bg-[oklch(0.2_0.03_var(--space-hue)/0.25)]" aria-hidden="true" onclick={onclose}></div>
  <div class="menu-surface relative overflow-hidden p-0">
    <PaletteBox {palette} {onclose} />
  </div>
</div>
