<script lang="ts">
  import { colorScheme } from '../primitives/color-scheme';
  import type { PageRelay } from './page-relay.svelte';
  import PaletteBox from './PaletteBox.svelte';
  import type { PaletteState } from './palette-state.svelte';

  let { palette, relay, onclose }: { palette: PaletteState; relay: PageRelay; onclose: () => void } = $props();
</script>

<!-- The palette over a web page: a dimmed backdrop and a centered box tinted like the sidebar (the active Volet's hue,
     which comes with each answer; Search's default until then). -->
<div
  class="palette-root fixed inset-0 z-2147483647 font-sans antialiased"
  data-scheme={colorScheme()}
  style:--space-hue={palette.hue ?? 268}
>
  <div class="absolute inset-0 bg-[oklch(0.2_0.03_var(--space-hue)/0.28)]" aria-hidden="true" onclick={onclose}></div>
  <!-- Positioned without transforms: Tailwind's are built on @property, which a shadow root ignores. -->
  <div
    class="absolute inset-x-0 top-[14vh] mx-auto w-[min(640px,calc(100vw-32px))] overflow-hidden rounded-[14px] bg-(--menu) text-ink [box-shadow:var(--overlay-shadow)]"
    role="dialog"
    aria-modal="true"
    aria-label="Search"
  >
    <PaletteBox {palette} {onclose} caret={relay.caret} onfocus={() => relay.native()} />
  </div>
</div>
