<script lang="ts">
  import { paletteKey } from '@/lib/model/palette-relay';
  import type { SearchLauncher } from '@/lib/model/search-launcher';

  let { search }: { search: SearchLauncher } = $props();

  /**
   * The panel's hidden field while Search shows over the page: the panel keeps the keyboard, so typing lands here (with
   * accents, paste, word moves and input methods, as in any field) and goes to the page, which shows it as its own.
   */
  let left = false;
  const takeKeyboard = (input: HTMLInputElement) => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    input.focus({ preventScroll: true });
    // Search closed while typing here (a result ran, Escape): the keyboard goes back where it was.
    return () => {
      if (!left) previous?.focus({ preventScroll: true });
    };
  };
  /** Starts from what Search over the page holds (typed there before the panel took over). */
  const seeded = (input: HTMLInputElement) => {
    const { value, start, end } = search.seed;
    input.value = value;
    input.setSelectionRange(start, end);
  };
  const report = (input: HTMLInputElement) => {
    const end = input.value.length;
    search.text({ value: input.value, start: input.selectionStart ?? end, end: input.selectionEnd ?? end });
  };
</script>

<input
  class="sr-only"
  aria-label="Search tabs and pins"
  autocomplete="off"
  spellcheck="false"
  data-search-relay
  oninput={(event) => report(event.currentTarget)}
  onselect={(event) => report(event.currentTarget)}
  onkeyup={(event) => report(event.currentTarget)}
  onkeydown={(event) => {
    const key = paletteKey(event);
    if (key) {
      // Search's keys, not the panel's (Escape would also clear a selection of rows).
      event.preventDefault();
      event.stopPropagation();
      search.key(key);
      return;
    }
    // The keyboard stays in Search.
    if (event.key === 'Tab') {
      event.preventDefault();
      return;
    }
    // Caret moves (arrows, Home, word moves) land after the key.
    const input = event.currentTarget;
    setTimeout(() => report(input));
  }}
  onblur={() => {
    left = true;
    search.leave();
  }}
  {@attach seeded}
  {@attach takeKeyboard}
/>
<!-- The highlighted result, read out: the results show over the page, out of the panel's reach. -->
<span class="sr-only" aria-live="polite">{search.announcement}</span>
