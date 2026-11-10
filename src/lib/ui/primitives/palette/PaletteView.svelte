<script lang="ts">
  import { Search } from '@lucide/svelte';
  import { untrack } from 'svelte';
  import type { PaletteItem } from '@/lib/model/palette';
  import { paletteKey, type PaletteKey } from '@/lib/model/palette-relay';
  import PaletteRow from './PaletteRow.svelte';
  import RelayCaret from './RelayCaret.svelte';

  interface Props {
    query: string;
    items: PaletteItem[];
    selected: number;
    oninput: (text: string) => void;
    /** Arrows and Ctrl+N/P, Enter, Escape (`paletteKey`). */
    onkey: (key: PaletteKey) => void;
    onpick: (index: number) => void;
    onhover: (index: number) => void;
    /**
     * Where the caret is while another field types into this one (the Volet panel's): drawn, as a field shows none
     * while its page doesn't have the keyboard. The field then takes no focus when it appears.
     */
    caret?: { start: number; end: number };
    /** The field got the keyboard (a click into it). */
    onfocus?: () => void;
  }

  let { query, items, selected, oninput, onkey, onpick, onhover, caret, onfocus }: Props = $props();

  const listId = 'palette-results';
  const optionId = (index: number) => `palette-option-${index}`;

  /** The field, for a drawn caret to measure. */
  let input = $state<HTMLInputElement>();

  /** Takes the keyboard as it appears, unless another field types into it (`caret`). */
  const field = (node: HTMLInputElement) => {
    input = node;
    if (!untrack(() => caret)) node.focus();
    return () => {
      input = undefined;
    };
  };

  /** Keep the selected option in view as the arrow keys move (re-runs when `selected` changes). */
  const scrollIntoView = (list: HTMLElement) => {
    list.querySelector(`#${optionId(selected)}`)?.scrollIntoView({ block: 'nearest' });
  };
</script>

<div class="flex max-h-[min(460px,70vh)] flex-col">
  <label class="flex h-12 flex-none items-center gap-3 border-b border-rule px-4">
    <Search size={16} strokeWidth={2} class="flex-none text-ink-muted" />
    <span class="relative flex h-full min-w-0 flex-1">
      <input
        class="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-muted"
        placeholder="Search tabs, pins, or type a URL"
        role="combobox"
        aria-expanded={items.length > 0}
        aria-controls={listId}
        aria-activedescendant={items.length ? optionId(selected) : undefined}
        aria-autocomplete="list"
        autocomplete="off"
        spellcheck="false"
        value={query}
        oninput={(event) => oninput(event.currentTarget.value)}
        onkeydown={(event) => {
          const key = paletteKey(event);
          if (!key) return;
          event.preventDefault();
          onkey(key);
        }}
        {onfocus}
        {@attach field}
      />
      {#if caret && input}
        <RelayCaret {input} value={query} start={caret.start} end={caret.end} />
      {/if}
    </span>
  </label>
  <div id={listId} role="listbox" aria-label="Results" class="min-h-0 flex-1 overflow-y-auto p-1.5" {@attach scrollIntoView}>
    {#each items as item, index (item.id)}
      <PaletteRow
        {item}
        id={optionId(index)}
        selected={index === selected}
        onpick={() => onpick(index)}
        onhover={() => onhover(index)}
      />
    {:else}
      <p class="px-3 py-6 text-center text-[13px] text-ink-muted">No matches. Press Enter to search the web.</p>
    {/each}
  </div>
</div>
