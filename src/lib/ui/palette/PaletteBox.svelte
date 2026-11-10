<script lang="ts">
  import PaletteView from '../primitives/palette/PaletteView.svelte';
  import type { PaletteState } from './palette-state.svelte';

  interface Props {
    /** Made by whoever shows Search, so the Volet panel can type into it too (`PageRelay`). */
    palette: PaletteState;
    onclose: () => void;
    /** Where the caret is while the Volet panel types into Search (see `PaletteView`). */
    caret?: { start: number; end: number };
    onfocus?: () => void;
  }

  let { palette, onclose, caret, onfocus }: Props = $props();

  // Results for what Search holds as it appears (nothing yet, usually).
  // svelte-ignore state_referenced_locally
  void palette.search(palette.query);

  async function pick(index: number) {
    if (await palette.run(index)) onclose();
  }
</script>

<PaletteView
  query={palette.query}
  items={palette.items}
  selected={palette.selected}
  oninput={(text) => void palette.search(text)}
  onkey={(key) => void palette.press(key, onclose)}
  onpick={(index) => void pick(index)}
  onhover={(index) => palette.select(index)}
  {caret}
  {onfocus}
/>
