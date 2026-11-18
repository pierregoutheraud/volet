<script lang="ts">
  import { mergeProps } from 'bits-ui';
  import type { Snippet } from 'svelte';
  import Tooltip from './tooltip/Tooltip.svelte';

  interface Props {
    label: string;
    /** Tooltip, when it should say more than the label. */
    hint?: string;
    /** Optional when the button gets its behavior from `rest` (e.g. a menu's trigger props). */
    onclick?: () => void;
    /** Only visible while the parent row is hovered or focused. */
    reveal?: boolean;
    /**
     * With `reveal`: takes no room either until then, so a button always shown beside it keeps to the
     * row's edge instead of sitting over the title.
     */
    collapse?: boolean;
    children: Snippet;
    /** Extra attributes and handlers for the button (e.g. a menu's trigger props). */
    [key: string]: unknown;
  }

  let { label, hint, onclick, reveal = false, collapse = false, children, ...rest }: Props = $props();
</script>

<Tooltip label={hint ?? label}>
  {#snippet trigger(props)}
    <button
      type="button"
      {...mergeProps(props, rest, {
        class: [
          // The hover fades in and out (and so does `reveal`).
          'grid h-6 place-items-center rounded-[7px] text-ink-muted transition-[opacity,background-color,color] duration-150',
          // Icons don't take the pointer: the button does, so a shared tooltip sees it go button to button.
          'hover:bg-hover hover:text-ink *:pointer-events-none',
          reveal && 'opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 group-data-hovered/row:opacity-100',
          // Its width snaps (it fades in, but leaves at once): the title's room snaps too, so neither
          // ever runs over the other.
          reveal && collapse
            ? 'w-0 overflow-hidden group-focus-within/row:w-6 group-hover/row:w-6 group-data-hovered/row:w-6'
            : 'w-6',
        ],
        'aria-label': label,
        'data-no-drag': '',
        onclick: (event: MouseEvent) => {
          event.stopPropagation();
          onclick?.();
        },
      })}
    >
      {@render children()}
    </button>
  {/snippet}
</Tooltip>
