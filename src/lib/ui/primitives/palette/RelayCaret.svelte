<script lang="ts">
  interface Props {
    /** The field the caret is drawn over. */
    input: HTMLInputElement;
    value: string;
    start: number;
    end: number;
  }

  let { input, value, start, end }: Props = $props();

  /**
   * A field shows no caret while its page doesn't have the keyboard, as when Search is typed into from the Volet
   * panel: this draws one where the panel's field has it (and its selection), measured in the field's own font.
   */
  const context = document.createElement('canvas').getContext('2d');
  const font = $derived(getComputedStyle(input).font);
  const measure = (text: string) => {
    if (!context) return 0;
    context.font = font;
    return context.measureText(text).width;
  };

  const startX = $derived(measure(value.slice(0, start)));
  const endX = $derived(measure(value.slice(0, end)));
  /** Text longer than the field scrolls just enough to keep the caret in view. */
  const scroll = $derived(measure(value) <= input.clientWidth ? 0 : Math.max(0, endX - input.clientWidth + 2));

  // The field's own text scrolls along.
  $effect(() => {
    input.scrollLeft = scroll;
  });
</script>

<!-- Over the field, never in the pointer's way. Sizes in px: rem is the page's own here. -->
<span class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true" data-relay-caret>
  {#if end > start}
    <span
      class="absolute top-[calc(50%-10px)] h-5 bg-selected"
      style:left="{startX - scroll}px"
      style:width="{endX - startX}px"
    ></span>
  {:else}
    <!-- Restarts its blink at each move, like a real caret, and doesn't blink with reduced motion. -->
    {#key start}
      <span
        class="absolute top-[calc(50%-9px)] h-[18px] w-[1.5px] animate-[caret-blink_1.06s_step-end_infinite] bg-ink motion-reduce:animate-none"
        style:left="{startX - scroll}px"
      ></span>
    {/key}
  {/if}
</span>
