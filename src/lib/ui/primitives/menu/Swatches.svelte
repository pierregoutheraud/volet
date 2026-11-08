<script lang="ts">
  import { ContextMenu } from 'bits-ui';
  import HueSlider from './HueSlider.svelte';

  interface Props {
    label: string;
    hues: number[];
    selected?: number;
    onSelect: (hue: number) => void;
    /** Shows a slider for any hue: called with each hue while it moves, then `undefined` once it's saved. */
    onPreview?: (hue: number | undefined) => void;
  }

  let { label, hues, selected, onSelect, onPreview }: Props = $props();

  /** The hue shown: the selected one, or where the slider is, so the ring follows it onto a swatch and off. */
  let current = $derived(selected);
</script>

<!-- A row of color dots inside a menu; each one is a menu item (arrow keys reach them).
     The slider under them, as wide as the row, picks any other hue. -->
<ContextMenu.Group class="px-2 py-1.5" aria-label={label}>
  <div class="mb-1.5 text-[11px] font-medium text-ink-muted">{label}</div>
  <div class="grid w-max gap-2">
    <div class="flex gap-1.5">
      {#each hues as hue (hue)}
        <ContextMenu.Item
          class="grid size-6 place-items-center rounded-full outline-none data-highlighted:ring-2 data-highlighted:ring-(--focus) [[data-unfocused]_&:hover]:ring-2 [[data-unfocused]_&:hover]:ring-(--focus)"
          aria-label="Hue {hue}"
          onSelect={() => onSelect(hue)}
        >
          <span
            class={['block size-4 rounded-full', hue === current && 'ring-2 ring-ink ring-offset-1 ring-offset-pill']}
            style:background="oklch(var(--dot-l) var(--dot-c) {hue})"
          ></span>
        </ContextMenu.Item>
      {/each}
    </div>
    {#if onPreview}
      <!-- Inset to line up with the dots themselves (each sits in the middle of a wider item). -->
      <div class="px-1 pb-0.5">
        <HueSlider
          label="Custom color"
          value={current ?? hues[0] ?? 0}
          oninput={(hue) => {
            current = hue;
            onPreview(hue);
          }}
          oncommit={(hue) => {
            // Saved first: the store shows the new hue at once, so ending the preview doesn't flash the old one.
            onSelect(hue);
            onPreview(undefined);
          }}
        />
      </div>
    {/if}
  </div>
</ContextMenu.Group>
